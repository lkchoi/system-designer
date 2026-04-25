import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { buildClaudeMd, type ScaffoldedServiceMeta } from "./claude-md";

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

function design(
  name: string,
  nodes: Node<SystemNodeData>[],
  edges: { source: string; target: string; label?: string }[] = [],
): DesignJSON {
  return {
    version: 1,
    name,
    nodes: nodes as unknown as DesignJSON["nodes"],
    edges: edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      ...(e.label ? { label: e.label } : {}),
    })) as unknown as DesignJSON["edges"],
    viewport: { x: 0, y: 0, zoom: 1 },
    flowPaths: [],
  };
}

describe("buildClaudeMd", () => {
  it("renders the standard top-level sections", () => {
    const svc = makeNode("svc", "service", {
      label: "API",
      description: "Public API",
      plan: { technology: "Node.js" },
    });
    const md = buildClaudeMd(
      design("demo", [svc]),
      new Map([["svc", "api"]]),
      new Map([["svc", [8080]]]),
      new Map<string, ScaffoldedServiceMeta>([
        ["svc", { techId: "nodejs", testCommand: "npm test" }],
      ]),
    );
    expect(md.startsWith("# CLAUDE.md\n")).toBe(true);
    expect(md).toContain("## What This Is");
    expect(md).toContain("Docker Compose local stack for demo.");
    expect(md).toContain("## Commands");
    expect(md).toContain("./start.sh");
    expect(md).toContain("docker compose run --rm --no-deps api npm test");
    expect(md).toContain("## Architecture");
    expect(md).toContain("### Services (Node.js)");
  });

  it("groups runtimes in the services heading", () => {
    const a = makeNode("a", "service", { label: "A" });
    const b = makeNode("b", "service", { label: "B" });
    const md = buildClaudeMd(
      design("d", [a, b]),
      new Map([
        ["a", "a"],
        ["b", "b"],
      ]),
      new Map([
        ["a", [8080]],
        ["b", [8081]],
      ]),
      new Map<string, ScaffoldedServiceMeta>([
        ["a", { techId: "nodejs", testCommand: "npm test" }],
        ["b", { techId: "python-fastapi", testCommand: "pytest" }],
      ]),
    );
    expect(md).toMatch(
      /### Services \((Node\.js|Python \(FastAPI\))(, (Node\.js|Python \(FastAPI\)))\)/,
    );
  });

  it("lists outgoing connections per service", () => {
    const svc = makeNode("svc", "service", { label: "API" });
    const db = makeNode("db", "database", {
      label: "OrdersDB",
      plan: { technology: "PostgreSQL" },
    });
    const cache = makeNode("c", "cache", { label: "Sessions", plan: { technology: "Redis" } });
    const md = buildClaudeMd(
      design(
        "d",
        [svc, db, cache],
        [
          { source: "svc", target: "db" },
          { source: "svc", target: "c" },
        ],
      ),
      new Map([
        ["svc", "api"],
        ["db", "orders-db"],
        ["c", "sessions"],
      ]),
      new Map([
        ["svc", [8080]],
        ["db", [5432]],
        ["c", [6379]],
      ]),
      new Map<string, ScaffoldedServiceMeta>([
        ["svc", { techId: "nodejs", testCommand: "npm test" }],
      ]),
    );
    expect(md).toContain("Connects to `orders-db` and `sessions`.");
  });

  it("renders the data-flow block with edge labels when present", () => {
    const a = makeNode("a", "service", { label: "A" });
    const b = makeNode("b", "service", { label: "B" });
    const md = buildClaudeMd(
      design("d", [a, b], [{ source: "a", target: "b", label: "publishes" }]),
      new Map([
        ["a", "a"],
        ["b", "b"],
      ]),
      new Map([
        ["a", [8080]],
        ["b", [8081]],
      ]),
      new Map(),
    );
    expect(md).toContain("a --publishes--> b");
  });

  it("flags Postgres init scripts and Redis env in conventions", () => {
    const svc = makeNode("svc", "service", { label: "API" });
    const db = makeNode("db", "database", { label: "DB", plan: { technology: "PostgreSQL" } });
    const cache = makeNode("c", "cache", { label: "Cache", plan: { technology: "Redis" } });
    const md = buildClaudeMd(
      design("d", [svc, db, cache]),
      new Map([
        ["svc", "api"],
        ["db", "primary-db"],
        ["c", "cache"],
      ]),
      new Map([
        ["svc", [8080]],
        ["db", [5432]],
        ["c", [6379]],
      ]),
      new Map<string, ScaffoldedServiceMeta>([
        ["svc", { techId: "nodejs", testCommand: "npm test" }],
      ]),
    );
    expect(md).toContain("init/primary-db/schema.sql");
    expect(md).toContain("REDIS_URL");
    expect(md).toContain("DATABASE_URL");
  });

  it("omits the data-flow section when there are no deployable edges", () => {
    const svc = makeNode("svc", "service", { label: "API" });
    const md = buildClaudeMd(
      design("d", [svc]),
      new Map([["svc", "api"]]),
      new Map([["svc", [8080]]]),
      new Map<string, ScaffoldedServiceMeta>([
        ["svc", { techId: "nodejs", testCommand: "npm test" }],
      ]),
    );
    expect(md).not.toContain("## Data Flow");
  });
});
