import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { buildServiceEnv } from "./wiring";

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

function designWith(
  nodes: Node<SystemNodeData>[],
  edges: { source: string; target: string }[],
): DesignJSON {
  return {
    version: 1,
    name: "t",
    nodes: nodes as unknown as DesignJSON["nodes"],
    edges: edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
    })) as unknown as DesignJSON["edges"],
    viewport: { x: 0, y: 0, zoom: 1 },
    flowPaths: [],
  };
}

describe("buildServiceEnv", () => {
  it("returns empty env for a service with no outgoing edges", () => {
    const svc = makeNode("svc", "service", { plan: { technology: "Node.js (Express/Fastify)" } });
    const db = makeNode("db", "database", { plan: { technology: "PostgreSQL" } });
    const env = buildServiceEnv(
      svc,
      designWith([svc, db], []),
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
    const env = buildServiceEnv(
      svc,
      designWith([svc, db], [{ source: "svc", target: "db" }]),
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
    const env = buildServiceEnv(
      svc,
      designWith([svc, cache], [{ source: "svc", target: "cache" }]),
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
    const env = buildServiceEnv(
      svc,
      designWith([svc, kafka], [{ source: "svc", target: "k" }]),
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
    const env = buildServiceEnv(
      svc,
      designWith([svc, bucket], [{ source: "svc", target: "b" }]),
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
    const env = buildServiceEnv(
      svc,
      designWith([svc, bucket], [{ source: "svc", target: "b" }]),
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
    const env = buildServiceEnv(
      svc,
      designWith([svc, bucket], [{ source: "svc", target: "b" }]),
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
    const env = buildServiceEnv(
      svc,
      designWith(
        [svc, db1, db2],
        [
          { source: "svc", target: "db1" },
          { source: "svc", target: "db2" },
        ],
      ),
      new Map([
        ["svc", "svc"],
        ["db1", "primary"],
        ["db2", "secondary"],
      ]),
    );
    expect(env.DB_HOST).toBe("primary");
  });

  it("explicit node env overrides auto-wired values", () => {
    const svc = makeNode("svc", "service", {
      env: { DB_HOST: "custom-host", EXTRA: "1" },
    });
    const db = makeNode("db", "database", { plan: { technology: "PostgreSQL" } });
    const env = buildServiceEnv(
      svc,
      designWith([svc, db], [{ source: "svc", target: "db" }]),
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
