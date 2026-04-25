import { describe, it, expect } from "vitest";
import { mergeConcerns } from "./merge";
import { resolveConcerns, type ConnectionInfo } from "./resolve";
import { getClientConcern } from "./clients/index";
import { scaffoldService } from "../index";
import type { SystemNodeData } from "../../../types";
import type { LangSnippet } from "./types";

// ─── mergeConcerns ──────────────────────────────────────────────────────

describe("mergeConcerns", () => {
  it("merges deps, deduplicates imports, concatenates arrays", () => {
    const a: LangSnippet = {
      deps: { pg: "^8.13.1" },
      imports: ['import pg from "pg";'],
      globals: ["const pool = new pg.Pool();"],
      init: ["await pool.connect();"],
      shutdown: ["await pool.end();"],
      healthChecks: ['await pool.query("SELECT 1");'],
    };
    const b: LangSnippet = {
      deps: { ioredis: "^5.4.1" },
      imports: ['import Redis from "ioredis";'],
      globals: ["const redis = new Redis();"],
      init: [],
      shutdown: ["await redis.quit();"],
      healthChecks: ["await redis.ping();"],
    };
    const merged = mergeConcerns([a, b]);
    expect(merged.deps).toEqual({ pg: "^8.13.1", ioredis: "^5.4.1" });
    expect(merged.imports).toHaveLength(2);
    expect(merged.globals).toHaveLength(2);
    expect(merged.init).toHaveLength(1);
    expect(merged.shutdown).toHaveLength(2);
    expect(merged.healthChecks).toHaveLength(2);
  });

  it("deduplicates identical imports", () => {
    const a: LangSnippet = {
      deps: {},
      imports: ['"context"'],
      globals: [],
      init: [],
      shutdown: [],
      healthChecks: [],
    };
    const b: LangSnippet = {
      deps: {},
      imports: ['"context"', '"log"'],
      globals: [],
      init: [],
      shutdown: [],
      healthChecks: [],
    };
    const merged = mergeConcerns([a, b]);
    expect(merged.imports).toEqual(['"context"', '"log"']);
  });

  it("returns empty slots for empty input", () => {
    const merged = mergeConcerns([]);
    expect(merged.deps).toEqual({});
    expect(merged.imports).toEqual([]);
  });
});

// ─── resolveConcerns ────────────────────────────────────────────────────

describe("resolveConcerns", () => {
  it("resolves redis + postgresql for node", () => {
    const connections: ConnectionInfo[] = [
      { targetName: "cache", targetComponentType: "cache", targetTechId: "redis" },
      { targetName: "db", targetComponentType: "database", targetTechId: "postgresql" },
    ];
    const slots = resolveConcerns("node", connections);
    expect(slots.deps).toHaveProperty("ioredis");
    expect(slots.deps).toHaveProperty("pg");
    expect(slots.imports.some((i) => i.includes("ioredis"))).toBe(true);
    expect(slots.imports.some((i) => i.includes("pg"))).toBe(true);
    expect(slots.healthChecks.length).toBe(2);
  });

  it("resolves kafka for go", () => {
    const connections: ConnectionInfo[] = [
      { targetName: "events", targetComponentType: "message-queue", targetTechId: "kafka" },
    ];
    const slots = resolveConcerns("go", connections);
    expect(slots.deps).toHaveProperty("github.com/segmentio/kafka-go");
    expect(slots.imports.some((i) => i.includes("kafka-go"))).toBe(true);
  });

  it("deduplicates by targetTechId", () => {
    const connections: ConnectionInfo[] = [
      { targetName: "cache-1", targetComponentType: "cache", targetTechId: "redis" },
      { targetName: "cache-2", targetComponentType: "cache", targetTechId: "redis" },
    ];
    const slots = resolveConcerns("node", connections);
    expect(slots.healthChecks).toHaveLength(1);
  });

  it("returns empty slots for unknown tech", () => {
    const connections: ConnectionInfo[] = [
      { targetName: "x", targetComponentType: "database", targetTechId: "unknown-db" },
    ];
    const slots = resolveConcerns("node", connections);
    expect(Object.keys(slots.deps)).toHaveLength(0);
  });

  it("returns empty slots for empty connections", () => {
    const slots = resolveConcerns("node", []);
    expect(Object.keys(slots.deps)).toHaveLength(0);
    expect(slots.imports).toHaveLength(0);
  });
});

// ─── getClientConcern ───────────────────────────────────────────────────

describe("getClientConcern", () => {
  it.each([
    "redis",
    "postgresql",
    "mysql",
    "mongodb",
    "kafka",
    "rabbitmq",
    "nats",
    "s3",
    "elasticsearch",
    "clickhouse",
  ])("has a concern registered for %s", (techId) => {
    const concern = getClientConcern(techId);
    expect(concern).toBeDefined();
    expect(concern!.snippet.node).toBeDefined();
    expect(concern!.snippet.python).toBeDefined();
    expect(concern!.snippet.go).toBeDefined();
  });

  it("returns undefined for unregistered tech", () => {
    expect(getClientConcern("not-a-tech")).toBeUndefined();
  });
});

// ─── Integration: scaffoldService with connections ──────────────────────

describe("scaffoldService with connections", () => {
  const baseData: SystemNodeData = {
    label: "API",
    description: "",
    componentType: "service",
    status: "healthy",
    metrics: { cpu: 0, memory: 0, requestsPerSec: 0, latency: 0 },
    plan: { technology: "Node.js (Express/Fastify)" },
    sharded: false,
    shardKey: "",
    endpoints: [],
    links: [],
    capClassification: "",
    stressFailure: "none",
    capacityPercent: 50,
    consumerRate: 0,
  };

  it("node scaffold includes pg dep when connected to postgresql", () => {
    const result = scaffoldService({
      serviceName: "api",
      data: baseData,
      endpoints: [],
      connections: [
        { targetName: "db", targetComponentType: "database", targetTechId: "postgresql" },
      ],
    });
    const pkg = JSON.parse(
      String(result.files.find((f) => f.path.endsWith("package.json"))!.content),
    );
    expect(pkg.dependencies.pg).toBeDefined();
    const indexJs = String(result.files.find((f) => f.path.endsWith("index.js"))!.content);
    expect(indexJs).toContain('import pg from "pg"');
    expect(indexJs).toContain("pool.query");
  });

  it("node scaffold includes ioredis + pg for redis + postgresql", () => {
    const result = scaffoldService({
      serviceName: "api",
      data: baseData,
      endpoints: [],
      connections: [
        { targetName: "cache", targetComponentType: "cache", targetTechId: "redis" },
        { targetName: "db", targetComponentType: "database", targetTechId: "postgresql" },
      ],
    });
    const pkg = JSON.parse(
      String(result.files.find((f) => f.path.endsWith("package.json"))!.content),
    );
    expect(pkg.dependencies.ioredis).toBeDefined();
    expect(pkg.dependencies.pg).toBeDefined();
    const indexJs = String(result.files.find((f) => f.path.endsWith("index.js"))!.content);
    expect(indexJs).toContain("Redis");
    expect(indexJs).toContain("pg.Pool");
  });

  it("go scaffold includes pgx in go.mod when connected to postgresql", () => {
    const goData = { ...baseData, plan: { technology: "Go" } };
    const result = scaffoldService({
      serviceName: "api",
      data: goData,
      endpoints: [],
      connections: [
        { targetName: "db", targetComponentType: "database", targetTechId: "postgresql" },
      ],
    });
    const goMod = String(result.files.find((f) => f.path.endsWith("go.mod"))!.content);
    expect(goMod).toContain("github.com/jackc/pgx/v5");
    const mainGo = String(result.files.find((f) => f.path.endsWith("main.go"))!.content);
    expect(mainGo).toContain("pgxpool");
    expect(mainGo).toContain("dbPool.Ping");
  });

  it("python scaffold includes psycopg2-binary when connected to postgresql", () => {
    const pyData = { ...baseData, plan: { technology: "Python (FastAPI/Django)" } };
    const result = scaffoldService({
      serviceName: "api",
      data: pyData,
      endpoints: [],
      connections: [
        { targetName: "db", targetComponentType: "database", targetTechId: "postgresql" },
      ],
    });
    const reqs = String(result.files.find((f) => f.path.endsWith("requirements.txt"))!.content);
    expect(reqs).toContain("psycopg2-binary");
    const mainPy = String(result.files.find((f) => f.path.endsWith("main.py"))!.content);
    expect(mainPy).toContain("psycopg2");
  });

  it("scaffold without connections produces no extra deps", () => {
    const result = scaffoldService({
      serviceName: "api",
      data: baseData,
      endpoints: [],
      connections: [],
    });
    const pkg = JSON.parse(
      String(result.files.find((f) => f.path.endsWith("package.json"))!.content),
    );
    expect(Object.keys(pkg.dependencies)).toHaveLength(0);
  });
});
