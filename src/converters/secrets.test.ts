import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Node } from "@xyflow/react";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { generateSecrets } from "./secrets";

beforeEach(() => {
  // Make randomSecret deterministic for assertions.
  let counter = 0;
  vi.spyOn(crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView | null>(arr: T): T => {
    const view = new Uint8Array(arr!.buffer, arr!.byteOffset, arr!.byteLength);
    for (let i = 0; i < view.length; i++) view[i] = (counter++ + i) & 0xff;
    return arr;
  });
});

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

function design(nodes: Node<SystemNodeData>[]): DesignJSON {
  return {
    version: 1,
    name: "t",
    nodes: nodes as unknown as DesignJSON["nodes"],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    flowPaths: [],
  };
}

describe("generateSecrets", () => {
  it("emits a password var per postgres node and sets POSTGRES_PASSWORD on its container", () => {
    const db = makeNode("db1", "database", { plan: { technology: "PostgreSQL", database: "users" } });
    const result = generateSecrets(design([db]), new Map([["db1", "orders-db"]]));

    expect(result.envFileContent).toContain("ORDERS_DB_PASSWORD=");
    const containerEnv = result.containerEnv.get("db1")!;
    expect(containerEnv.POSTGRES_USER).toBe("admin");
    expect(containerEnv.POSTGRES_DB).toBe("users");
    expect(containerEnv.POSTGRES_PASSWORD).toBe("${ORDERS_DB_PASSWORD}");
    expect(result.credentials).toContainEqual({
      serviceName: "orders-db",
      kind: "postgres",
      user: "admin",
      passwordVar: "ORDERS_DB_PASSWORD",
    });
  });

  it("emits MYSQL_ROOT_PASSWORD for a mysql node", () => {
    const db = makeNode("db1", "database", { plan: { technology: "MySQL" } });
    const result = generateSecrets(design([db]), new Map([["db1", "core-db"]]));

    expect(result.envFileContent).toContain("CORE_DB_PASSWORD=");
    expect(result.containerEnv.get("db1")!.MYSQL_ROOT_PASSWORD).toBe("${CORE_DB_PASSWORD}");
  });

  it("emits a user + password pair for a minio node", () => {
    const bucket = makeNode("b1", "storage", { plan: { technology: "Amazon S3" } });
    const result = generateSecrets(design([bucket]), new Map([["b1", "assets"]]));

    expect(result.envFileContent).toContain("ASSETS_ROOT_USER=");
    expect(result.envFileContent).toContain("ASSETS_ROOT_PASSWORD=");
    const env = result.containerEnv.get("b1")!;
    expect(env.MINIO_ROOT_USER).toBe("${ASSETS_ROOT_USER}");
    expect(env.MINIO_ROOT_PASSWORD).toBe("${ASSETS_ROOT_PASSWORD}");
  });

  it("does not emit a password for mongodb but still sets the init db", () => {
    const db = makeNode("db", "database", {
      plan: { technology: "MongoDB", database: "analytics" },
    });
    const result = generateSecrets(design([db]), new Map([["db", "logs"]]));

    expect(result.envFileContent).not.toContain("LOGS_PASSWORD");
    expect(result.containerEnv.get("db")!.MONGO_INITDB_DATABASE).toBe("analytics");
    expect(result.credentials).toEqual([]);
  });

  it("ignores stateless nodes", () => {
    const svc = makeNode("svc", "service");
    const result = generateSecrets(design([svc]), new Map([["svc", "api"]]));

    // No secret lines at all — just the auto-generated header comment.
    expect(result.envFileContent).not.toMatch(/^[A-Z][A-Z0-9_]*=/m);
    expect(result.containerEnv.size).toBe(0);
    expect(result.credentials).toEqual([]);
  });
});
