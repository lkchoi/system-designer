import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import type { SystemNodeData } from "../types";
import { buildServiceEnv, buildEdgeIndex } from "./wiring";

function makeNode(
  id: string,
  componentType: SystemNodeData["componentType"],
  overrides: Partial<SystemNodeData> = {},
): Node<SystemNodeData> {
  return {
    id,
    type: "system",
    position: { x: 0, y: 0 },
    data: {
      label: id,
      description: "",
      componentType,
      status: "healthy",
      metrics: { cpu: 0, memory: 0, requestsPerSec: 0, latency: 0 },
      plan: {},
      sharded: false,
      shardKey: "",
      endpoints: [],
      links: [],
      capClassification: "",
      stressFailure: "none",
      capacityPercent: 50,
      consumerRate: 0,
      ...overrides,
    },
  };
}

/** Convenience wrapper: builds edge index and calls buildServiceEnv. */
function wireEnv(
  serviceNode: Node<SystemNodeData>,
  nodes: Node<SystemNodeData>[],
  edges: { source: string; target: string }[],
  nameMap: Map<string, string>,
): Record<string, string> {
  return buildServiceEnv(serviceNode, buildEdgeIndex(edges), nodes, nameMap);
}

describe("buildServiceEnv", () => {
  it("returns empty env for a service with no outgoing edges", () => {
    const svc = makeNode("svc", "service", { plan: { technology: "Node.js (Express/Fastify)" } });
    const db = makeNode("db", "database", { plan: { technology: "PostgreSQL" } });
    const env = wireEnv(
      svc, [svc, db], [],
      new Map([
        ["svc", "svc"],
        ["db", "db"],
      ]),
    );
    expect(env).toEqual({});
  });

  it("wires postgres edges into DB_* and DATABASE_URL", () => {
    const svc = makeNode("svc", "service");
    const db = makeNode("db", "database", {
      plan: { technology: "PostgreSQL", database: "users" },
    });
    const env = wireEnv(
      svc, [svc, db], [{ source: "svc", target: "db" }],
      new Map([
        ["svc", "svc"],
        ["db", "orders-db"],
      ]),
    );
    expect(env.DB_HOST).toBe("orders-db");
    expect(env.DB_PORT).toBe("5432");
    expect(env.DB_USER).toBe("admin");
    expect(env.DB_PASSWORD).toBe("${ORDERS_DB_PASSWORD}");
    expect(env.DB_NAME).toBe("users");
    expect(env.DATABASE_URL).toBe("postgres://admin:${ORDERS_DB_PASSWORD}@orders-db:5432/users");
  });

  it("wires a redis cache into REDIS_URL", () => {
    const svc = makeNode("svc", "service");
    const cache = makeNode("cache", "cache", { plan: { technology: "Redis" } });
    const env = wireEnv(
      svc, [svc, cache], [{ source: "svc", target: "cache" }],
      new Map([
        ["svc", "svc"],
        ["cache", "sessions"],
      ]),
    );
    expect(env.REDIS_URL).toBe("redis://sessions:6379");
  });

  it("wires kafka into KAFKA_BOOTSTRAP_SERVERS", () => {
    const svc = makeNode("svc", "service");
    const kafka = makeNode("k", "message-queue", { plan: { technology: "Apache Kafka" } });
    const env = wireEnv(
      svc, [svc, kafka], [{ source: "svc", target: "k" }],
      new Map([
        ["svc", "svc"],
        ["k", "events"],
      ]),
    );
    expect(env.KAFKA_BOOTSTRAP_SERVERS).toBe("events:9092");
  });

  it("wires minio into S3_* + AWS_ENDPOINT_URL", () => {
    const svc = makeNode("svc", "service");
    const bucket = makeNode("b", "storage", {
      plan: { technology: "Amazon S3", bucketName: "uploads" },
    });
    const env = wireEnv(
      svc, [svc, bucket], [{ source: "svc", target: "b" }],
      new Map([
        ["svc", "svc"],
        ["b", "assets"],
      ]),
    );
    expect(env.S3_ENDPOINT).toBe("http://assets:9000");
    expect(env.S3_BUCKET).toBe("uploads");
    expect(env.S3_ACCESS_KEY).toBe("${ASSETS_ROOT_USER}");
    expect(env.AWS_ENDPOINT_URL).toBe("http://assets:9000");
  });

  it("strips s3:// prefixes and trailing paths from bucketName", () => {
    const svc = makeNode("svc", "service");
    const bucket = makeNode("b", "storage", {
      plan: { technology: "Amazon S3", bucketName: "s3://my-bucket/some/path" },
    });
    const env = wireEnv(
      svc, [svc, bucket], [{ source: "svc", target: "b" }],
      new Map([
        ["svc", "svc"],
        ["b", "assets"],
      ]),
    );
    expect(env.S3_BUCKET).toBe("my-bucket");
  });

  it("falls back to 'default' when bucketName is empty", () => {
    const svc = makeNode("svc", "service");
    const bucket = makeNode("b", "storage", { plan: { technology: "Amazon S3" } });
    const env = wireEnv(
      svc, [svc, bucket], [{ source: "svc", target: "b" }],
      new Map([
        ["svc", "svc"],
        ["b", "assets"],
      ]),
    );
    expect(env.S3_BUCKET).toBe("default");
  });

  it("keeps only the first edge of a given wiring kind", () => {
    const svc = makeNode("svc", "service");
    const db1 = makeNode("db1", "database", { plan: { technology: "PostgreSQL" } });
    const db2 = makeNode("db2", "database", { plan: { technology: "PostgreSQL" } });
    const env = wireEnv(
      svc,
      [svc, db1, db2],
      [
        { source: "svc", target: "db1" },
        { source: "svc", target: "db2" },
      ],
      new Map([
        ["svc", "svc"],
        ["db1", "primary"],
        ["db2", "secondary"],
      ]),
    );
    expect(env.DB_HOST).toBe("primary");
  });

  it("wires mysql into DB_* and DATABASE_URL with mysql:// prefix", () => {
    const svc = makeNode("svc", "service");
    const db = makeNode("db", "database", {
      plan: { technology: "MySQL", database: "orders" },
    });
    const env = wireEnv(
      svc, [svc, db], [{ source: "svc", target: "db" }],
      new Map([
        ["svc", "svc"],
        ["db", "mysql-db"],
      ]),
    );
    expect(env.DB_HOST).toBe("mysql-db");
    expect(env.DB_PORT).toBe("3306");
    expect(env.DB_USER).toBe("admin");
    expect(env.DB_PASSWORD).toBe("${MYSQL_DB_PASSWORD}");
    expect(env.DB_NAME).toBe("orders");
    expect(env.DATABASE_URL).toBe("mysql://admin:${MYSQL_DB_PASSWORD}@mysql-db:3306/orders");
  });

  it("wires mongo into MONGO_* vars", () => {
    const svc = makeNode("svc", "service");
    const db = makeNode("db", "database", {
      plan: { technology: "MongoDB", database: "analytics" },
    });
    const env = wireEnv(
      svc, [svc, db], [{ source: "svc", target: "db" }],
      new Map([
        ["svc", "svc"],
        ["db", "docs-db"],
      ]),
    );
    expect(env.MONGO_HOST).toBe("docs-db");
    expect(env.MONGO_PORT).toBe("27017");
    expect(env.MONGO_DB).toBe("analytics");
    expect(env.MONGO_URL).toBe("mongodb://docs-db:27017/analytics");
  });

  it("wires rabbitmq into RABBITMQ_URL with amqp://", () => {
    const svc = makeNode("svc", "service");
    const mq = makeNode("mq", "message-queue", { plan: { technology: "RabbitMQ" } });
    const env = wireEnv(
      svc, [svc, mq], [{ source: "svc", target: "mq" }],
      new Map([
        ["svc", "svc"],
        ["mq", "broker"],
      ]),
    );
    expect(env.RABBITMQ_URL).toBe("amqp://guest:guest@broker:5672");
  });

  it("wires nats into NATS_URL with nats://", () => {
    const svc = makeNode("svc", "service");
    const mq = makeNode("mq", "message-queue", { plan: { technology: "NATS" } });
    const env = wireEnv(
      svc, [svc, mq], [{ source: "svc", target: "mq" }],
      new Map([
        ["svc", "svc"],
        ["mq", "bus"],
      ]),
    );
    expect(env.NATS_URL).toBe("nats://bus:4222");
  });

  it("wires redis as message-queue into REDIS_URL", () => {
    const svc = makeNode("svc", "service");
    const mq = makeNode("mq", "message-queue", { plan: { technology: "Redis" } });
    const env = wireEnv(
      svc, [svc, mq], [{ source: "svc", target: "mq" }],
      new Map([
        ["svc", "svc"],
        ["mq", "redis-mq"],
      ]),
    );
    expect(env.REDIS_URL).toBe("redis://redis-mq:6379");
  });

  it("wires elasticsearch into ES_URL with http://", () => {
    const svc = makeNode("svc", "service");
    const se = makeNode("se", "search-engine", { plan: { technology: "Elasticsearch" } });
    const env = wireEnv(
      svc, [svc, se], [{ source: "svc", target: "se" }],
      new Map([
        ["svc", "svc"],
        ["se", "search"],
      ]),
    );
    expect(env.ES_URL).toBe("http://search:9200");
  });

  it("wires clickhouse (data-warehouse) into WAREHOUSE_URL", () => {
    const svc = makeNode("svc", "service");
    const wh = makeNode("wh", "data-warehouse", { plan: { technology: "ClickHouse" } });
    const env = wireEnv(
      svc, [svc, wh], [{ source: "svc", target: "wh" }],
      new Map([
        ["svc", "svc"],
        ["wh", "analytics-wh"],
      ]),
    );
    expect(env.WAREHOUSE_URL).toBe("http://analytics-wh:8123");
  });

  it("returns empty env for unsupported component types", () => {
    const svc = makeNode("svc", "service");
    const dns = makeNode("dns", "dns" as SystemNodeData["componentType"]);
    const client = makeNode("client", "client" as SystemNodeData["componentType"]);
    const env = wireEnv(
      svc,
      [svc, dns, client],
      [
        { source: "svc", target: "dns" },
        { source: "svc", target: "client" },
      ],
      new Map([
        ["svc", "svc"],
        ["dns", "route53"],
        ["client", "browser"],
      ]),
    );
    expect(env).toEqual({});
  });

  it("explicit node env overrides auto-wired values", () => {
    const svc = makeNode("svc", "service", {
      env: { DB_HOST: "custom-host", EXTRA: "1" },
    });
    const db = makeNode("db", "database", { plan: { technology: "PostgreSQL" } });
    const env = wireEnv(
      svc, [svc, db], [{ source: "svc", target: "db" }],
      new Map([
        ["svc", "svc"],
        ["db", "pg"],
      ]),
    );
    expect(env.DB_HOST).toBe("custom-host");
    expect(env.EXTRA).toBe("1");
    expect(env.DB_PORT).toBe("5432");
  });
});
