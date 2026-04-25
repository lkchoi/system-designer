import { describe, it, expect } from "vitest";
import { nomadConverter } from "./nomad";
import type { DesignJSON } from "../db/io";

const SAMPLE_DESIGN: DesignJSON = {
  version: 1,
  name: "OrdersPlatform",
  nodes: [
    {
      id: "svc",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "API",
        description: "REST service",
        componentType: "service",
        plan: { technology: "Node.js (Express/Fastify)", replicas: "3" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "db",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "OrdersDB",
        componentType: "database",
        plan: { technology: "PostgreSQL" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "cache",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "Sessions",
        componentType: "cache",
        plan: { technology: "Redis" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "fn",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "ImageResizer",
        componentType: "serverless",
        plan: { technology: "AWS Lambda" },
        endpoints: [],
        links: [],
      },
    },
  ] as unknown as DesignJSON["nodes"],
  edges: [] as unknown as DesignJSON["edges"],
  viewport: { x: 0, y: 0, zoom: 1 },
  flowPaths: [],
};

describe("nomad converter", () => {
  function parse(design: DesignJSON): Record<string, unknown> {
    const json = nomadConverter.exportDesign(design).content as string;
    return JSON.parse(json);
  }

  it("returns a .nomad.json filename", () => {
    const result = nomadConverter.exportDesign(SAMPLE_DESIGN);
    expect(result.filename).toBe("OrdersPlatform.nomad.json");
    expect(result.mimeType).toBe("application/json");
  });

  it("does not support import", () => {
    expect(nomadConverter.canImport).toBe(false);
  });

  it("wraps groups in a job spec", () => {
    const spec = parse(SAMPLE_DESIGN);
    expect(spec.job).toBeDefined();
    const job = spec.job as Record<string, unknown[]>;
    expect(job["ordersplatform"]).toBeDefined();
  });

  it("sets datacenters to dc1", () => {
    const spec = parse(SAMPLE_DESIGN);
    const job = spec.job as Record<string, unknown[]>;
    const entry = job["ordersplatform"][0] as Record<string, unknown>;
    expect(entry.datacenters).toEqual(["dc1"]);
  });

  it("creates a group per node with a docker image", () => {
    const spec = parse(SAMPLE_DESIGN);
    const job = spec.job as Record<string, unknown[]>;
    const entry = job["ordersplatform"][0] as { group: Record<string, unknown> };
    // Nomad only generates for nodes with docker mapping, Lambda has none
    expect(entry.group["api"]).toBeDefined();
    expect(entry.group["ordersdb"]).toBeDefined();
    expect(entry.group["sessions"]).toBeDefined();
    expect(entry.group["imageresizer"]).toBeUndefined();
  });

  it("uses the correct docker image", () => {
    const json = nomadConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(json).toContain("node:22-alpine");
    expect(json).toContain("postgres:17-alpine");
    expect(json).toContain("redis:8-alpine");
  });

  it("respects replicas from plan field", () => {
    const spec = parse(SAMPLE_DESIGN);
    const job = spec.job as Record<string, unknown[]>;
    const entry = job["ordersplatform"][0] as { group: Record<string, unknown[]> };
    const apiGroup = entry.group["api"][0] as { count: number };
    expect(apiGroup.count).toBe(3);
  });

  it("uses database-specific port for database nodes", () => {
    const json = nomadConverter.exportDesign(SAMPLE_DESIGN).content as string;
    const spec = JSON.parse(json);
    const job = spec.job as Record<string, unknown[]>;
    const entry = job["ordersplatform"][0] as { group: Record<string, unknown[]> };
    const dbGroup = entry.group["ordersdb"][0] as {
      network: Array<{ port: { http: Array<{ static: number }> } }>;
    };
    expect(dbGroup.network[0].port.http[0].static).toBe(5432);
  });

  it("uses cache-specific port for cache nodes", () => {
    const spec = parse(SAMPLE_DESIGN);
    const job = spec.job as Record<string, unknown[]>;
    const entry = job["ordersplatform"][0] as { group: Record<string, unknown[]> };
    const cacheGroup = entry.group["sessions"][0] as {
      network: Array<{ port: { http: Array<{ static: number }> } }>;
    };
    expect(cacheGroup.network[0].port.http[0].static).toBe(6379);
  });

  it("adds description as task meta", () => {
    const json = nomadConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(json).toContain("REST service");
  });

  it("handles an empty design", () => {
    const empty: DesignJSON = {
      version: 1,
      name: "Empty",
      nodes: [] as unknown as DesignJSON["nodes"],
      edges: [] as unknown as DesignJSON["edges"],
      viewport: { x: 0, y: 0, zoom: 1 },
      flowPaths: [],
    };
    const spec = parse(empty);
    const job = spec.job as Record<string, unknown[]>;
    const entry = job["empty"][0] as { group: Record<string, unknown> };
    expect(Object.keys(entry.group)).toHaveLength(0);
  });
});
