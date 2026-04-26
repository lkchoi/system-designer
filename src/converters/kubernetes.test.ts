import { describe, it, expect } from "vitest";
import { kubernetesConverter } from "./kubernetes";
import type { DesignJSON } from "../db/io";
import type { ExportResult } from "./types";

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
        description: "Public REST surface",
        componentType: "service",
        plan: { technology: "Node.js (Express/Fastify)" },
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
      id: "gw",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "Edge Gateway",
        componentType: "api-gateway",
        plan: { technology: "NGINX" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "cron",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "Cleanup Job",
        componentType: "cron",
        plan: { technology: "EventBridge", schedule: "0 3 * * *" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "waf",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "WAF",
        componentType: "firewall",
        plan: { technology: "AWS WAF" },
        endpoints: [],
        links: [],
      },
    },
  ] as unknown as DesignJSON["nodes"],
  edges: [
    { id: "e1", source: "svc", target: "db" },
    { id: "e2", source: "svc", target: "cache" },
  ] as unknown as DesignJSON["edges"],
  viewport: { x: 0, y: 0, zoom: 1 },
  flowPaths: [],
};

describe("kubernetes converter — export", () => {
  it("returns a YAML filename and text/yaml mimeType", () => {
    const result = kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult;
    expect(result.filename).toBe("OrdersPlatform-manifests.yaml");
    expect(result.mimeType).toBe("text/yaml");
  });

  it("creates a Namespace document from the design name", () => {
    const result = kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult;
    const yaml = result.content as string;
    expect(yaml).toContain("kind: Namespace");
    expect(yaml).toContain("name: ordersplatform");
  });

  it("generates a StatefulSet for a database node", () => {
    const yaml = (kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("kind: StatefulSet");
    expect(yaml).toContain("image: postgres:17-alpine");
    expect(yaml).toContain("name: ordersdb");
  });

  it("generates a Deployment for a service node", () => {
    const yaml = (kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toMatch(/kind: Deployment/);
    expect(yaml).toContain("image: node:22-alpine");
    expect(yaml).toContain("name: api");
  });

  it("generates a Deployment for a cache node", () => {
    const yaml = (kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("image: redis:8-alpine");
    expect(yaml).toContain("name: sessions");
  });

  it("pairs each workload with a ClusterIP Service", () => {
    const yaml = (kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("kind: Service");
    expect(yaml).toContain("type: ClusterIP");
  });

  it("generates an Ingress for an api-gateway node", () => {
    const yaml = (kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("kind: Ingress");
    expect(yaml).toContain("name: edge-gateway");
  });

  it("generates a CronJob for a cron node with its schedule", () => {
    const yaml = (kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("kind: CronJob");
    expect(yaml).toContain("schedule: 0 3 * * *");
    expect(yaml).toContain("name: cleanup-job");
  });

  it("generates a NetworkPolicy for a firewall node", () => {
    const yaml = (kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("kind: NetworkPolicy");
    expect(yaml).toContain("name: waf-policy");
  });

  it("adds description as an annotation", () => {
    const yaml = (kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("description: Public REST surface");
  });

  it("includes arkon/component-type labels on workloads", () => {
    const yaml = (kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("arkon/component-type: service");
    expect(yaml).toContain("arkon/component-type: database");
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
    const yaml = (kubernetesConverter.exportDesign(empty) as ExportResult).content as string;
    expect(yaml).toContain("kind: Namespace");
    // Only the namespace doc, no workloads
    expect(yaml).not.toContain("kind: Deployment");
    expect(yaml).not.toContain("kind: StatefulSet");
  });

  it("deduplicates names with same label", () => {
    const design: DesignJSON = {
      version: 1,
      name: "Dup",
      nodes: [
        {
          id: "a",
          type: "system",
          position: { x: 0, y: 0 },
          data: {
            label: "API",
            componentType: "service",
            plan: { technology: "Node.js (Express/Fastify)" },
            endpoints: [],
            links: [],
          },
        },
        {
          id: "b",
          type: "system",
          position: { x: 0, y: 0 },
          data: {
            label: "API",
            componentType: "service",
            plan: { technology: "Go" },
            endpoints: [],
            links: [],
          },
        },
      ] as unknown as DesignJSON["nodes"],
      edges: [] as unknown as DesignJSON["edges"],
      viewport: { x: 0, y: 0, zoom: 1 },
      flowPaths: [],
    };
    const yaml = (kubernetesConverter.exportDesign(design) as ExportResult).content as string;
    expect(yaml).toContain("name: api\n");
    expect(yaml).toContain("name: api-2\n");
  });

  it("respects replicas from plan field", () => {
    const design: DesignJSON = {
      version: 1,
      name: "Scale",
      nodes: [
        {
          id: "svc",
          type: "system",
          position: { x: 0, y: 0 },
          data: {
            label: "Worker",
            componentType: "service",
            plan: { technology: "Go", replicas: "3" },
            endpoints: [],
            links: [],
          },
        },
      ] as unknown as DesignJSON["nodes"],
      edges: [] as unknown as DesignJSON["edges"],
      viewport: { x: 0, y: 0, zoom: 1 },
      flowPaths: [],
    };
    const yaml = (kubernetesConverter.exportDesign(design) as ExportResult).content as string;
    expect(yaml).toContain("replicas: 3");
  });
});

describe("kubernetes converter — import", () => {
  it("round-trips a design through export then import", () => {
    const exported = (kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    const imported = kubernetesConverter.importDesign!(exported);
    expect(imported.name).toBe("Imported from Kubernetes");
    // Should recover nodes for workloads (not namespace or service docs)
    expect(imported.nodes.length).toBeGreaterThan(0);
  });

  it("recovers component type from arkon label", () => {
    const exported = (kubernetesConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    const imported = kubernetesConverter.importDesign!(exported);
    const dbNode = imported.nodes.find((n) => n.id === "ordersdb");
    expect(dbNode).toBeDefined();
    expect((dbNode!.data as { componentType: string }).componentType).toBe("database");
  });

  it("skips Namespace and Service docs during import", () => {
    const yaml = `apiVersion: v1
kind: Namespace
metadata:
  name: test
---
apiVersion: v1
kind: Service
metadata:
  name: my-svc
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    arkon/component-type: service`;
    const imported = kubernetesConverter.importDesign!(yaml);
    expect(imported.nodes).toHaveLength(1);
    expect(imported.nodes[0].id).toBe("my-app");
  });
});
