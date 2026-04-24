import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { resolveTechId } from "./iac-mapping";
import type { BundleFile } from "./bundle";

/**
 * Init-script files generated from the design and a description of where to
 * mount them inside each container, so the docker-compose generator can
 * pin them in via volumes.
 */
export interface InitScripts {
  /** Files to drop into the bundle (paths like `init/<service>/schema.sql`). */
  files: BundleFile[];
  /** For each node, the host path → container path volume mounts to add. */
  mountsByNodeId: Map<string, Array<{ host: string; container: string; readOnly?: boolean }>>;
  /**
   * One-shot sidecar services to add to the compose file. Each runs an init
   * script after its target service is up, then exits. Used for MinIO bucket
   * creation, Kafka topic creation, ES index creation — anything that doesn't
   * have a docker-entrypoint convention.
   */
  sidecars: InitSidecar[];
}

export interface InitSidecar {
  /** Compose service name, e.g. "uploads-init". */
  name: string;
  image: string;
  /** Service this sidecar depends on (waits for it to start). */
  dependsOn: string;
  /** Inline shell command (passed to /bin/sh -c). */
  command: string;
  environment?: Record<string, string>;
  volumes?: string[];
}

export function generateInitScripts(
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
): InitScripts {
  const files: BundleFile[] = [];
  const mountsByNodeId = new Map<
    string,
    Array<{ host: string; container: string; readOnly?: boolean }>
  >();
  const sidecars: InitSidecar[] = [];

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    const serviceName = serviceNameByNodeId.get(node.id);
    if (!serviceName) continue;

    const techId = resolveTechId(data.componentType, data.plan?.technology ?? "", "docker");

    if (data.componentType === "database" && isPostgresLike(techId)) {
      const sql = renderPostgresSchema(data);
      files.push({ path: `init/${serviceName}/schema.sql`, content: sql });
      mountsByNodeId.set(node.id, [
        {
          host: `./init/${serviceName}`,
          container: "/docker-entrypoint-initdb.d",
          readOnly: true,
        },
      ]);
    } else if (data.componentType === "database" && isMysqlLike(techId)) {
      const sql = renderMysqlSchema(data);
      files.push({ path: `init/${serviceName}/schema.sql`, content: sql });
      mountsByNodeId.set(node.id, [
        {
          host: `./init/${serviceName}`,
          container: "/docker-entrypoint-initdb.d",
          readOnly: true,
        },
      ]);
    } else if (data.componentType === "storage" && (techId === "s3" || techId === "minio")) {
      const buckets = parseList(data.plan?.bucketName).map(stripBucketPath).filter(Boolean);
      if (buckets.length === 0) continue;
      const script = renderMinioBuckets(serviceName, buckets);
      files.push({ path: `init/${serviceName}/create-buckets.sh`, content: script });
      sidecars.push({
        name: `${serviceName}-init`,
        image: "minio/mc:latest",
        dependsOn: serviceName,
        command: minioSidecarCmd(serviceName, buckets),
        environment: {
          MC_HOST_local: `http://\${${envVar(serviceName)}_ROOT_USER}:\${${envVar(serviceName)}_ROOT_PASSWORD}@${serviceName}:9000`,
        },
      });
    } else if (data.componentType === "message-queue" && techId === "kafka") {
      const topics = parseList(data.plan?.topics);
      if (topics.length === 0) continue;
      const partitions = parsePositiveInt(data.plan?.partitions, 1);
      const script = renderKafkaTopics(serviceName, topics, partitions);
      files.push({ path: `init/${serviceName}/create-topics.sh`, content: script });
      sidecars.push({
        name: `${serviceName}-init`,
        image: "confluentinc/cp-kafka:7.9.0",
        dependsOn: serviceName,
        command: kafkaSidecarCmd(serviceName, topics, partitions),
      });
    } else if (
      data.componentType === "search-engine" &&
      (techId === "elasticsearch" || techId === "opensearch")
    ) {
      const indexes = parseList(data.plan?.indexName);
      if (indexes.length === 0) continue;
      const script = renderEsIndexes(serviceName, indexes);
      files.push({ path: `init/${serviceName}/create-indexes.sh`, content: script });
      sidecars.push({
        name: `${serviceName}-init`,
        image: "curlimages/curl:8.11.1",
        dependsOn: serviceName,
        command: esSidecarCmd(serviceName, indexes),
      });
    } else if (data.componentType === "cron" && techId === "linux-cron") {
      const ini = renderOfeliaConfig(node.id, data, design, serviceNameByNodeId);
      files.push({ path: `init/${serviceName}/config.ini`, content: ini });
      const existing = mountsByNodeId.get(node.id) ?? [];
      mountsByNodeId.set(node.id, [
        ...existing,
        {
          host: `./init/${serviceName}/config.ini`,
          container: "/etc/ofelia/config.ini",
          readOnly: true,
        },
      ]);
    }
  }

  return { files, mountsByNodeId, sidecars };
}

function isPostgresLike(techId: string): boolean {
  return techId === "postgresql" || techId === "cockroachdb" || techId === "aurora";
}

function isMysqlLike(techId: string): boolean {
  return techId === "mysql" || techId === "mariadb";
}

/**
 * Postgres `/docker-entrypoint-initdb.d/*.sql` files run on first init only.
 * The container picks them up alphabetically, so naming this `schema.sql`
 * keeps the order stable.
 */
function renderPostgresSchema(data: SystemNodeData): string {
  const tables = parseList(data.plan?.tables);
  const primaryKey = data.plan?.primaryKey?.trim() || "id (UUID)";
  const sortKey = data.plan?.sortKey?.trim();
  const indexes = parseList(data.plan?.indexes);

  const lines: string[] = [
    `-- Auto-generated from the design's plan fields.`,
    `-- Edit and rerun ./reset.sh + ./start.sh to apply changes.`,
    "",
    `-- Plan: primary key = ${primaryKey}${sortKey ? `, sort key = ${sortKey}` : ""}`,
    "",
  ];

  if (tables.length === 0) {
    lines.push(`-- No tables declared on this Database node — add some via the Plan panel.`);
    return lines.join("\n") + "\n";
  }

  for (const table of tables) {
    lines.push(`CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} (`);
    lines.push(`  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),`);
    lines.push(`  created_at timestamptz NOT NULL DEFAULT now()`);
    lines.push(`);`);
    lines.push("");
  }

  if (indexes.length > 0) {
    lines.push(`-- Declared indexes from the design (stub — fill in target columns):`);
    for (const idx of indexes) {
      lines.push(`-- CREATE INDEX IF NOT EXISTS ${quoteIdent(idx)} ON <table> (<column>);`);
    }
  }

  return lines.join("\n") + "\n";
}

function renderMysqlSchema(data: SystemNodeData): string {
  const tables = parseList(data.plan?.tables);
  const primaryKey = data.plan?.primaryKey?.trim() || "id (UUID)";
  const sortKey = data.plan?.sortKey?.trim();
  const indexes = parseList(data.plan?.indexes);

  const lines: string[] = [
    `-- Auto-generated from the design's plan fields.`,
    `-- Edit and rerun ./reset.sh + ./start.sh to apply changes.`,
    "",
    `-- Plan: primary key = ${primaryKey}${sortKey ? `, sort key = ${sortKey}` : ""}`,
    "",
  ];

  if (tables.length === 0) {
    lines.push(`-- No tables declared on this Database node — add some via the Plan panel.`);
    return lines.join("\n") + "\n";
  }

  for (const table of tables) {
    lines.push(`CREATE TABLE IF NOT EXISTS \`${table}\` (`);
    lines.push(`  id CHAR(36) PRIMARY KEY,`);
    lines.push(`  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    lines.push(`);`);
    lines.push("");
  }

  if (indexes.length > 0) {
    lines.push(`-- Declared indexes from the design (stub — fill in target columns):`);
    for (const idx of indexes) {
      lines.push(`-- CREATE INDEX \`${idx}\` ON <table> (<column>);`);
    }
  }

  return lines.join("\n") + "\n";
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function envVar(serviceName: string): string {
  return serviceName.replace(/-/g, "_").toUpperCase();
}

function stripBucketPath(value: string): string {
  return value.replace(/^s3:\/\//, "").replace(/\/.*$/, "");
}

/** Quote a Postgres identifier only if it contains anything beyond [a-z0-9_]. */
function quoteIdent(name: string): string {
  return /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

function renderMinioBuckets(serviceName: string, buckets: string[]): string {
  const lines = buckets.map((b) => `mc mb --ignore-existing local/${b}`).join("\n");
  return `#!/bin/sh
# Auto-generated. Reapplied by the ${serviceName}-init sidecar on every \`./start.sh\`.
set -eu

# The sidecar receives MC_HOST_local from compose, so 'local' is pre-aliased.
${lines}
`;
}

function minioSidecarCmd(serviceName: string, buckets: string[]): string {
  // mc inside the official image uses the MC_HOST_<alias> env var so we don't
  // need to call \`mc alias set\`. We retry the first mb call so the sidecar
  // tolerates a slow MinIO start.
  const lines = buckets.map((b) => `mc mb --ignore-existing local/${b}`).join(" && ");
  return `until mc ls local >/dev/null 2>&1; do echo "waiting for ${serviceName}…"; sleep 1; done; ${lines}`;
}

function renderKafkaTopics(serviceName: string, topics: string[], partitions: number): string {
  const lines = topics
    .map(
      (t) =>
        `kafka-topics --bootstrap-server ${serviceName}:9092 --create --if-not-exists --topic ${t} --partitions ${partitions} --replication-factor 1`,
    )
    .join("\n");
  return `#!/bin/sh
# Auto-generated. Reapplied by the ${serviceName}-init sidecar on every \`./start.sh\`.
set -eu

${lines}
`;
}

function kafkaSidecarCmd(serviceName: string, topics: string[], partitions: number): string {
  const lines = topics
    .map(
      (t) =>
        `kafka-topics --bootstrap-server ${serviceName}:9092 --create --if-not-exists --topic ${t} --partitions ${partitions} --replication-factor 1`,
    )
    .join(" && ");
  return `until kafka-topics --bootstrap-server ${serviceName}:9092 --list >/dev/null 2>&1; do echo "waiting for ${serviceName}…"; sleep 2; done; ${lines}`;
}

function renderEsIndexes(serviceName: string, indexes: string[]): string {
  const lines = indexes
    .map(
      (i) =>
        `curl -sf -X PUT "http://${serviceName}:9200/${i}" -H 'content-type: application/json' -d '{}' || true`,
    )
    .join("\n");
  return `#!/bin/sh
# Auto-generated. Reapplied by the ${serviceName}-init sidecar on every \`./start.sh\`.
set -eu

${lines}
`;
}

function esSidecarCmd(serviceName: string, indexes: string[]): string {
  const puts = indexes
    .map(
      (i) =>
        `curl -sf -X PUT "http://${serviceName}:9200/${i}" -H 'content-type: application/json' -d '{}' || true`,
    )
    .join(" && ");
  return `until curl -sf "http://${serviceName}:9200/_cluster/health?wait_for_status=yellow&timeout=1s" >/dev/null; do echo "waiting for ${serviceName}…"; sleep 2; done; ${puts}`;
}

function renderOfeliaConfig(
  cronNodeId: string,
  data: SystemNodeData,
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
): string {
  const schedule = data.plan?.schedule?.trim() || "@hourly";
  const command = data.plan?.command?.trim() || 'echo "no command"';
  // The cron node may connect to a service it should exec the command in.
  const targetEdge = design.edges.find((e) => e.source === cronNodeId);
  const targetName = targetEdge ? serviceNameByNodeId.get(targetEdge.target) : undefined;

  const jobName = `job-${data.label.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "tick"}`;

  if (targetName) {
    return `# Auto-generated.
[job-exec "${jobName}"]
schedule = ${schedule}
container = ${targetName}
command = ${command}
`;
  }
  // No target — fall back to a "local" job that runs in ofelia's own container.
  return `# Auto-generated.
[job-local "${jobName}"]
schedule = ${schedule}
command = ${command}
`;
}
