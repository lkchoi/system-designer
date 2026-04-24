import { describe, it, expect } from "vitest";
import { scaffoldService } from "./index";
import type { SystemNodeData } from "../../types";

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

describe("scaffoldService — node.js", () => {
  it("produces Dockerfile, package.json, src/index.js, .dockerignore", () => {
    const result = scaffoldService({ serviceName: "api", data: baseData, endpoints: [] });
    const paths = result.files.map((f) => f.path).sort();
    expect(paths).toEqual([
      "services/api/.dockerignore",
      "services/api/Dockerfile",
      "services/api/package.json",
      "services/api/src/index.js",
    ]);
    expect(result.buildContext).toBe("./services/api");
    expect(result.containerPort).toBe(8080);
  });

  it("emits a /health route always", () => {
    const result = scaffoldService({ serviceName: "api", data: baseData, endpoints: [] });
    const index = String(result.files.find((f) => f.path.endsWith("index.js"))!.content);
    expect(index).toContain('url === "/health"');
  });

  it("turns declared endpoints into stub handlers", () => {
    const result = scaffoldService({
      serviceName: "api",
      data: baseData,
      endpoints: [
        { id: "1", method: "GET", path: "/users" },
        { id: "2", method: "POST", path: "/orders" },
      ],
    });
    const index = String(result.files.find((f) => f.path.endsWith("index.js"))!.content);
    expect(index).toContain('req.method === "GET" && url === "/users"');
    expect(index).toContain('req.method === "POST" && url === "/orders"');
    expect(index).toContain('"GET /users"');
  });

  it("Dockerfile installs prod deps and exposes the service port", () => {
    const result = scaffoldService({ serviceName: "api", data: baseData, endpoints: [] });
    const dockerfile = String(result.files.find((f) => f.path.endsWith("Dockerfile"))!.content);
    expect(dockerfile).toContain("FROM node:22-alpine");
    expect(dockerfile).toContain("npm install --omit=dev");
    expect(dockerfile).toContain("EXPOSE 8080");
  });

  it("package.json includes a start script and the service name", () => {
    const result = scaffoldService({ serviceName: "orders-api", data: baseData, endpoints: [] });
    const pkg = JSON.parse(
      String(result.files.find((f) => f.path.endsWith("package.json"))!.content),
    );
    expect(pkg.name).toBe("orders-api");
    expect(pkg.scripts.start).toBe("node src/index.js");
  });
});
