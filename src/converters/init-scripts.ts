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

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    const serviceName = serviceNameByNodeId.get(node.id);
    if (!serviceName) continue;

    if (data.componentType !== "database") continue;
    const techId = resolveTechId(data.componentType, data.plan?.technology ?? "");

    if (isPostgresLike(techId)) {
      const sql = renderPostgresSchema(data);
      files.push({
        path: `init/${serviceName}/schema.sql`,
        content: sql,
      });
      mountsByNodeId.set(node.id, [
        {
          host: `./init/${serviceName}`,
          container: "/docker-entrypoint-initdb.d",
          readOnly: true,
        },
      ]);
    } else if (isMysqlLike(techId)) {
      const sql = renderMysqlSchema(data);
      files.push({
        path: `init/${serviceName}/schema.sql`,
        content: sql,
      });
      mountsByNodeId.set(node.id, [
        {
          host: `./init/${serviceName}`,
          container: "/docker-entrypoint-initdb.d",
          readOnly: true,
        },
      ]);
    }
  }

  return { files, mountsByNodeId };
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

/** Quote a Postgres identifier only if it contains anything beyond [a-z0-9_]. */
function quoteIdent(name: string): string {
  return /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;
}
