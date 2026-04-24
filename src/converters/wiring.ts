import type { Node } from "@xyflow/react";
import type { DesignJSON } from "../db/io";
import type { ComponentType, SystemNodeData } from "../types";
import { getDefaultPorts, resolveTechId } from "./iac-mapping";

/**
 * Walk a Service node's outgoing edges and produce env vars naming the
 * connected Database / Cache / Storage / MQ / Search / Warehouse / Stream
 * Processor services.
 *
 * Var values are mostly `${VAR}` references so the .env file (next task)
 * is the single place that holds passwords. Hostnames + ports are inlined
 * because they're deterministic from the design.
 *
 * Multiple connections of the same kind: first one wins. This keeps the
 * generated env predictable; users with multiple DBs of the same type can
 * override via the node's `env` field.
 */
export function buildServiceEnv(
  serviceNode: Node<SystemNodeData>,
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
): Record<string, string> {
  const env: Record<string, string> = {};
  const claimedKinds = new Set<string>();

  const outgoing = design.edges.filter((e) => e.source === serviceNode.id);
  for (const edge of outgoing) {
    const target = design.nodes.find((n) => n.id === edge.target);
    if (!target || target.type !== "system") continue;
    const data = target.data as SystemNodeData;
    const targetName = serviceNameByNodeId.get(target.id);
    if (!targetName) continue;

    const kind = wiringKindFor(data.componentType, data.plan?.technology ?? "");
    if (!kind || claimedKinds.has(kind)) continue;
    claimedKinds.add(kind);

    Object.assign(env, envVarsFor(kind, targetName, data));
  }

  // Explicit overrides from the node's `env` field win over auto-wiring.
  if (serviceNode.data.env) Object.assign(env, serviceNode.data.env);
  return env;
}

type WiringKind =
  | "postgres"
  | "mysql"
  | "mongo"
  | "redis"
  | "kafka"
  | "rabbitmq"
  | "nats"
  | "minio"
  | "elasticsearch"
  | "warehouse";

function wiringKindFor(componentType: ComponentType, technology: string): WiringKind | null {
  const techId = resolveTechId(componentType, technology, "docker");
  switch (componentType) {
    case "database":
      if (techId === "postgresql" || techId === "cockroachdb" || techId === "aurora")
        return "postgres";
      if (techId === "mysql" || techId === "mariadb") return "mysql";
      if (techId === "mongodb") return "mongo";
      return null;
    case "cache":
      if (techId === "redis") return "redis";
      return null;
    case "message-queue":
      if (techId === "kafka") return "kafka";
      if (techId === "rabbitmq") return "rabbitmq";
      if (techId === "nats") return "nats";
      if (techId === "redis") return "redis";
      return null;
    case "storage":
      if (techId === "s3" || techId === "minio") return "minio";
      return null;
    case "search-engine":
      if (techId === "elasticsearch" || techId === "opensearch") return "elasticsearch";
      return null;
    case "data-warehouse":
      if (techId === "clickhouse") return "warehouse";
      return null;
    default:
      return null;
  }
}

function envVarsFor(
  kind: WiringKind,
  targetName: string,
  data: SystemNodeData,
): Record<string, string> {
  const techId = resolveTechId(data.componentType, data.plan?.technology ?? "", "docker");
  const ports = getDefaultPorts(data.componentType, techId);
  const port = ports[0];
  const dbName = data.plan?.database || data.plan?.dbName || "app";
  const upper = targetName.replace(/-/g, "_").toUpperCase();

  switch (kind) {
    case "postgres":
      return {
        DB_HOST: targetName,
        DB_PORT: String(port),
        DB_USER: "admin",
        DB_PASSWORD: `\${${upper}_PASSWORD}`,
        DB_NAME: dbName,
        DATABASE_URL: `postgres://admin:\${${upper}_PASSWORD}@${targetName}:${port}/${dbName}`,
      };
    case "mysql":
      return {
        DB_HOST: targetName,
        DB_PORT: String(port),
        DB_USER: "admin",
        DB_PASSWORD: `\${${upper}_PASSWORD}`,
        DB_NAME: dbName,
        DATABASE_URL: `mysql://admin:\${${upper}_PASSWORD}@${targetName}:${port}/${dbName}`,
      };
    case "mongo":
      return {
        MONGO_HOST: targetName,
        MONGO_PORT: String(port),
        MONGO_DB: dbName,
        MONGO_URL: `mongodb://${targetName}:${port}/${dbName}`,
      };
    case "redis":
      return { REDIS_URL: `redis://${targetName}:${port}` };
    case "kafka":
      return { KAFKA_BOOTSTRAP_SERVERS: `${targetName}:${port}` };
    case "rabbitmq":
      return {
        RABBITMQ_URL: `amqp://guest:guest@${targetName}:${port}`,
      };
    case "nats":
      return { NATS_URL: `nats://${targetName}:${port}` };
    case "minio": {
      const bucket = parseFirstBucket(data.plan?.bucketName) || "default";
      return {
        S3_ENDPOINT: `http://${targetName}:${port}`,
        S3_ACCESS_KEY: `\${${upper}_ROOT_USER}`,
        S3_SECRET_KEY: `\${${upper}_ROOT_PASSWORD}`,
        S3_BUCKET: bucket,
        AWS_ENDPOINT_URL: `http://${targetName}:${port}`,
      };
    }
    case "elasticsearch":
      return { ES_URL: `http://${targetName}:${port}` };
    case "warehouse":
      return { WAREHOUSE_URL: `http://${targetName}:${port}` };
  }
}

/**
 * Storage nodes can write `s3://bucket-name`, `bucket-name`, or a CSV like
 * `bucket-a, bucket-b`. Pull just the leading bucket name for env wiring.
 */
function parseFirstBucket(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const first = value.split(",")[0].trim();
  return first.replace(/^s3:\/\//, "").replace(/\/.*$/, "") || undefined;
}
