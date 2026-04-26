import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { buildLifecycleScripts, urlsFor } from "./lifecycle";

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
      plan: {},
      sharded: false,
      shardKey: "",
      endpoints: [],
      links: [],
      stressFailure: "none",
      capacityPercent: 50,
      consumerRate: 0,
      ...overrides,
    },
  };
}

function design(
  nodes: Node<SystemNodeData>[],
  edges: { source: string; target: string }[] = [],
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

/* ------------------------------------------------------------------ */
/*  urlsFor                                                           */
/* ------------------------------------------------------------------ */

describe("urlsFor", () => {
  it("postgres → postgres:// URL", () => {
    const result = urlsFor("database", "postgresql", "orders-db", [5432]);
    expect(result).toEqual([
      { label: "orders-db", url: "postgres://admin@localhost:5432/app" },
    ]);
  });

  it("mysql → mysql:// URL", () => {
    const result = urlsFor("database", "mysql", "users-db", [3306]);
    expect(result).toEqual([
      { label: "users-db", url: "mysql://root@localhost:3306" },
    ]);
  });

  it("mongodb → mongodb:// URL", () => {
    const result = urlsFor("database", "mongodb", "docs-db", [27017]);
    expect(result).toEqual([
      { label: "docs-db", url: "mongodb://localhost:27017" },
    ]);
  });

  it("unknown database tech → plain host:port", () => {
    const result = urlsFor("database", "unknown-db", "my-db", [9999]);
    expect(result).toEqual([{ label: "my-db", url: "localhost:9999" }]);
  });

  it("cache → redis:// URL", () => {
    const result = urlsFor("cache", "redis", "app-cache", [6379]);
    expect(result).toEqual([
      { label: "app-cache", url: "redis://localhost:6379" },
    ]);
  });

  it("kafka → host:port (kafka)", () => {
    const result = urlsFor("message-queue", "kafka", "events", [9092]);
    expect(result).toEqual([
      { label: "events", url: "localhost:9092 (kafka)" },
    ]);
  });

  it("rabbitmq with management port → amqp URL + mgmt URL", () => {
    const result = urlsFor("message-queue", "rabbitmq", "broker", [5672, 15672]);
    expect(result).toEqual([
      { label: "broker", url: "amqp://guest:guest@localhost:5672" },
      { label: "broker mgmt", url: "http://localhost:15672" },
    ]);
  });

  it("rabbitmq without management port → just amqp URL", () => {
    const result = urlsFor("message-queue", "rabbitmq", "broker", [5672]);
    expect(result).toEqual([
      { label: "broker", url: "amqp://guest:guest@localhost:5672" },
    ]);
  });

  it("storage with console port → api URL + console URL", () => {
    const result = urlsFor("storage", "minio", "files", [9000, 9001]);
    expect(result).toEqual([
      { label: "files api", url: "http://localhost:9000" },
      { label: "files console", url: "http://localhost:9001" },
    ]);
  });

  it("search-engine → http:// URL", () => {
    const result = urlsFor("search-engine", "elasticsearch", "search", [9200]);
    expect(result).toEqual([
      { label: "search", url: "http://localhost:9200" },
    ]);
  });

  it("service → http:// URL", () => {
    const result = urlsFor("service", "node", "api", [3000]);
    expect(result).toEqual([{ label: "api", url: "http://localhost:3000" }]);
  });

  it("returns empty array when no ports", () => {
    const result = urlsFor("database", "postgresql", "db", []);
    expect(result).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  buildLifecycleScripts                                             */
/* ------------------------------------------------------------------ */

describe("buildLifecycleScripts", () => {
  function build(
    nodes: Node<SystemNodeData>[],
    serviceNames: Record<string, string>,
    hostPorts: Record<string, number[]>,
  ) {
    const d = design(nodes);
    return buildLifecycleScripts(
      d,
      new Map(Object.entries(serviceNames)),
      new Map(Object.entries(hostPorts)),
    );
  }

  it("startSh includes docker compose up and postgres health check", () => {
    const nodes = [makeNode("db", "database", { plan: { technology: "PostgreSQL" } })];
    const { startSh } = build(nodes, { db: "orders-db" }, { db: [5432] });

    expect(startSh).toContain("docker compose up -d");
    expect(startSh).toContain("pg_isready");
    expect(startSh).toContain("orders-db");
  });

  it("startSh includes mysql health check", () => {
    const nodes = [makeNode("db", "database", { plan: { technology: "MySQL" } })];
    const { startSh } = build(nodes, { db: "users-db" }, { db: [3306] });

    expect(startSh).toContain("mysqladmin ping");
  });

  it("startSh includes mongodb health check", () => {
    const nodes = [makeNode("db", "database", { plan: { technology: "MongoDB" } })];
    const { startSh } = build(nodes, { db: "docs-db" }, { db: [27017] });

    expect(startSh).toContain("mongosh");
  });

  it("startSh includes redis cache health check", () => {
    const nodes = [makeNode("c", "cache", { plan: { technology: "Redis" } })];
    const { startSh } = build(nodes, { c: "app-cache" }, { c: [6379] });

    expect(startSh).toContain("redis-cli ping");
  });

  it("startSh includes kafka health check", () => {
    const nodes = [makeNode("mq", "message-queue", { plan: { technology: "Kafka" } })];
    const { startSh } = build(nodes, { mq: "events" }, { mq: [9092] });

    expect(startSh).toContain("kafka-topics");
  });

  it("startSh includes rabbitmq health check", () => {
    const nodes = [makeNode("mq", "message-queue", { plan: { technology: "RabbitMQ" } })];
    const { startSh } = build(nodes, { mq: "broker" }, { mq: [5672] });

    expect(startSh).toContain("rabbitmq-diagnostics ping");
  });

  it("startSh includes minio storage health check", () => {
    const nodes = [makeNode("s", "storage", { plan: { technology: "MinIO" } })];
    const { startSh } = build(nodes, { s: "files" }, { s: [9000, 9001] });

    expect(startSh).toContain("minio/health/live");
  });

  it("startSh includes elasticsearch health check", () => {
    const nodes = [makeNode("se", "search-engine", { plan: { technology: "Elasticsearch" } })];
    const { startSh } = build(nodes, { se: "search" }, { se: [9200] });

    expect(startSh).toContain("_cluster/health");
  });

  it("stopSh includes docker compose down and pid cleanup", () => {
    const nodes = [makeNode("db", "database", { plan: { technology: "PostgreSQL" } })];
    const { stopSh } = build(nodes, { db: "db" }, { db: [5432] });

    expect(stopSh).toContain("docker compose down");
    expect(stopSh).toContain(".pids");
    expect(stopSh).toContain("kill");
  });

  it("resetSh includes docker compose down -v", () => {
    const nodes = [makeNode("db", "database", { plan: { technology: "PostgreSQL" } })];
    const { resetSh } = build(nodes, { db: "db" }, { db: [5432] });

    expect(resetSh).toContain("docker compose down -v");
    expect(resetSh).toContain("rm -rf ./data");
  });

  it("startSh prints URLs at the end", () => {
    const nodes = [makeNode("db", "database", { plan: { technology: "PostgreSQL" } })];
    const { startSh } = build(nodes, { db: "orders-db" }, { db: [5432] });

    expect(startSh).toContain("Stack is up. URLs:");
    expect(startSh).toContain("postgres://admin@localhost:5432/app");
  });
});
