import { describe, it, expect } from "vitest";
import { buildReadme } from "./readme";
import type { DesignJSON } from "../db/io";
import type { BundleCredential } from "./secrets";
import type { ServiceUrl } from "./lifecycle";

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
      id: "lb",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "Edge LB",
        componentType: "load-balancer",
        plan: { technology: "AWS ALB" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "gw",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "Public Gateway",
        componentType: "api-gateway",
        plan: { technology: "AWS API Gateway" },
        endpoints: [{ id: "ep1", method: "GET", path: "/users" }],
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

// Only "svc" and "db" are deployed locally
const SERVICE_NAMES = new Map([
  ["svc", "api"],
  ["db", "ordersdb"],
]);

const URLS: ServiceUrl[] = [
  { label: "api", url: "http://localhost:8080" },
  { label: "ordersdb", url: "postgres://admin@localhost:5432/orders" },
];

const CREDENTIALS: BundleCredential[] = [
  { serviceName: "ordersdb", kind: "postgres", user: "admin", passwordVar: "ORDERSDB_PASSWORD" },
];

describe("buildReadme", () => {
  it("starts with the design name as heading", () => {
    const md = buildReadme(SAMPLE_DESIGN, SERVICE_NAMES, URLS, CREDENTIALS);
    expect(md).toMatch(/^# OrdersPlatform — local stack/);
  });

  it("includes prerequisites section", () => {
    const md = buildReadme(SAMPLE_DESIGN, SERVICE_NAMES, URLS, CREDENTIALS);
    expect(md).toContain("## Prerequisites");
    expect(md).toContain("Docker 25+");
  });

  it("includes quickstart section with shell commands", () => {
    const md = buildReadme(SAMPLE_DESIGN, SERVICE_NAMES, URLS, CREDENTIALS);
    expect(md).toContain("## Quickstart");
    expect(md).toContain("./start.sh");
    expect(md).toContain("./stop.sh");
    expect(md).toContain("./reset.sh");
  });

  it("includes service URLs table", () => {
    const md = buildReadme(SAMPLE_DESIGN, SERVICE_NAMES, URLS, CREDENTIALS);
    expect(md).toContain("## Service URLs");
    expect(md).toContain("http://localhost:8080");
    expect(md).toContain("postgres://admin@localhost:5432/orders");
  });

  it("includes credentials table", () => {
    const md = buildReadme(SAMPLE_DESIGN, SERVICE_NAMES, URLS, CREDENTIALS);
    expect(md).toContain("## Credentials");
    expect(md).toContain("ORDERSDB_PASSWORD");
    expect(md).toContain("postgres");
    expect(md).toContain("admin");
  });

  it("includes troubleshooting section", () => {
    const md = buildReadme(SAMPLE_DESIGN, SERVICE_NAMES, URLS, CREDENTIALS);
    expect(md).toContain("## Troubleshooting");
    expect(md).toContain("docker compose logs");
  });

  it("lists production-only components (LB, API gateway)", () => {
    const md = buildReadme(SAMPLE_DESIGN, SERVICE_NAMES, URLS, CREDENTIALS);
    expect(md).toContain("## Production-only components");
    expect(md).toContain("### Load Balancers");
    expect(md).toContain("Edge LB");
    expect(md).toContain("### API Gateways");
    expect(md).toContain("Public Gateway");
  });

  it("lists production-only component technology and endpoints", () => {
    const md = buildReadme(SAMPLE_DESIGN, SERVICE_NAMES, URLS, CREDENTIALS);
    expect(md).toContain("technology: AWS API Gateway");
    expect(md).toContain("`GET /users`");
  });

  it("lists cloud services not yet runnable locally", () => {
    const md = buildReadme(SAMPLE_DESIGN, SERVICE_NAMES, URLS, CREDENTIALS);
    expect(md).toContain("## Cloud services not yet runnable locally");
    expect(md).toContain("ImageResizer");
    expect(md).toContain("LocalStack");
  });

  it("omits URLs section when no URLs provided", () => {
    const md = buildReadme(SAMPLE_DESIGN, SERVICE_NAMES, [], CREDENTIALS);
    expect(md).not.toContain("## Service URLs");
  });

  it("omits credentials section when no credentials provided", () => {
    const md = buildReadme(SAMPLE_DESIGN, SERVICE_NAMES, URLS, []);
    expect(md).not.toContain("## Credentials");
  });

  it("omits production-only section when no excluded-tier nodes", () => {
    const design: DesignJSON = {
      version: 1,
      name: "Minimal",
      nodes: [
        {
          id: "svc",
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
    const md = buildReadme(design, new Map([["svc", "api"]]), [], []);
    expect(md).not.toContain("## Production-only components");
  });

  it("ends with a trailing newline", () => {
    const md = buildReadme(SAMPLE_DESIGN, SERVICE_NAMES, URLS, CREDENTIALS);
    expect(md).toMatch(/\n$/);
  });
});
