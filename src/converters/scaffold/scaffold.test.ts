import { describe, it, expect } from "vitest";
import { scaffoldService } from "./index";
import type { SystemNodeData } from "../../types";

const baseData: SystemNodeData = {
  label: "API",
  description: "",
  componentType: "service",
  plan: { technology: "Node.js (Express/Fastify)" },
  sharded: false,
  shardKey: "",
  endpoints: [],
  links: [],
  stressFailure: "none",
  capacityPercent: 50,
  consumerRate: 0,
};

describe("scaffoldService — node.js", () => {
  it("produces Dockerfile, package.json, src/index.js, test/health.test.js, .dockerignore", () => {
    const result = scaffoldService({ serviceName: "api", data: baseData, endpoints: [] });
    const paths = result.files.map((f) => f.path).sort();
    expect(paths).toEqual([
      "services/api/.dockerignore",
      "services/api/Dockerfile",
      "services/api/package.json",
      "services/api/src/index.js",
      "services/api/test/health.test.js",
    ]);
    expect(result.buildContext).toBe("./services/api");
    expect(result.containerPort).toBe(8080);
    expect(result.testCommand).toBe("npm test");
  });

  it("package.json includes vitest as a dev dep + test script", () => {
    const result = scaffoldService({ serviceName: "api", data: baseData, endpoints: [] });
    const pkg = JSON.parse(
      String(result.files.find((f) => f.path.endsWith("package.json"))!.content),
    );
    expect(pkg.devDependencies.vitest).toBeDefined();
    expect(pkg.scripts.test).toBe("vitest run");
  });

  it("test file imports makeHandler from src/index.js", () => {
    const result = scaffoldService({ serviceName: "api", data: baseData, endpoints: [] });
    const test = String(result.files.find((f) => f.path.endsWith("health.test.js"))!.content);
    expect(test).toContain('from "../src/index.js"');
    expect(test).toContain("makeHandler");
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

  it("Dockerfile installs deps (incl. dev) and exposes the service port", () => {
    const result = scaffoldService({ serviceName: "api", data: baseData, endpoints: [] });
    const dockerfile = String(result.files.find((f) => f.path.endsWith("Dockerfile"))!.content);
    expect(dockerfile).toContain("FROM node:22-alpine");
    expect(dockerfile).toContain("RUN npm install");
    expect(dockerfile).not.toContain("--omit=dev");
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

describe("scaffoldService — python", () => {
  const data: SystemNodeData = {
    ...baseData,
    plan: { technology: "Python (FastAPI/Django)" },
  };

  it("produces Dockerfile, requirements.txt, src + tests packages, .dockerignore", () => {
    const result = scaffoldService({ serviceName: "api", data, endpoints: [] });
    const paths = result.files.map((f) => f.path).sort();
    expect(paths).toEqual([
      "services/api/.dockerignore",
      "services/api/Dockerfile",
      "services/api/requirements.txt",
      "services/api/src/__init__.py",
      "services/api/src/main.py",
      "services/api/tests/__init__.py",
      "services/api/tests/test_health.py",
    ]);
    expect(result.containerPort).toBe(8000);
    expect(result.testCommand).toBe("pytest -q");
  });

  it("requirements pin pytest + httpx for the test client", () => {
    const result = scaffoldService({ serviceName: "api", data, endpoints: [] });
    const reqs = String(result.files.find((f) => f.path.endsWith("requirements.txt"))!.content);
    expect(reqs).toContain("pytest==");
    expect(reqs).toContain("httpx==");
  });

  it("emits a /health route + uvicorn launch", () => {
    const result = scaffoldService({ serviceName: "api", data, endpoints: [] });
    const main = String(result.files.find((f) => f.path.endsWith("main.py"))!.content);
    expect(main).toContain('@app.get("/health")');
    const dockerfile = String(result.files.find((f) => f.path.endsWith("Dockerfile"))!.content);
    expect(dockerfile).toContain("uvicorn");
  });

  it("turns endpoints into FastAPI route handlers", () => {
    const result = scaffoldService({
      serviceName: "api",
      data,
      endpoints: [{ id: "1", method: "POST", path: "/users/:id" }],
    });
    const main = String(result.files.find((f) => f.path.endsWith("main.py"))!.content);
    expect(main).toContain('@app.post("/users/:id")');
    expect(main).toContain("handle_post_users_id");
  });

  it("requirements.txt pins fastapi + uvicorn", () => {
    const result = scaffoldService({ serviceName: "api", data, endpoints: [] });
    const reqs = String(result.files.find((f) => f.path.endsWith("requirements.txt"))!.content);
    expect(reqs).toContain("fastapi==");
    expect(reqs).toContain("uvicorn[standard]");
  });
});

describe("scaffoldService — go", () => {
  const data: SystemNodeData = {
    ...baseData,
    plan: { technology: "Go (net/http, Gin, Fiber)" },
  };

  it("produces Dockerfile, go.mod, main.go, main_test.go, .dockerignore", () => {
    const result = scaffoldService({ serviceName: "api", data, endpoints: [] });
    const paths = result.files.map((f) => f.path).sort();
    expect(paths).toEqual([
      "services/api/.dockerignore",
      "services/api/Dockerfile",
      "services/api/go.mod",
      "services/api/main.go",
      "services/api/main_test.go",
    ]);
    expect(result.containerPort).toBe(8080);
    expect(result.testCommand).toBe("go test ./...");
  });

  it("main_test.go uses httptest against newMux", () => {
    const result = scaffoldService({ serviceName: "api", data, endpoints: [] });
    const test = String(result.files.find((f) => f.path.endsWith("main_test.go"))!.content);
    expect(test).toContain("net/http/httptest");
    expect(test).toContain("newMux().ServeHTTP");
  });

  it("emits a /health handler in main.go", () => {
    const result = scaffoldService({ serviceName: "api", data, endpoints: [] });
    const main = String(result.files.find((f) => f.path.endsWith("main.go"))!.content);
    expect(main).toContain('mux.HandleFunc("/health"');
    expect(main).toContain("package main");
  });

  it("turns endpoints into HandleFunc routes that gate on method", () => {
    const result = scaffoldService({
      serviceName: "api",
      data,
      endpoints: [{ id: "1", method: "GET", path: "/orders" }],
    });
    const main = String(result.files.find((f) => f.path.endsWith("main.go"))!.content);
    expect(main).toContain('mux.HandleFunc("/orders"');
    expect(main).toContain('r.Method != "GET"');
  });

  it("Dockerfile uses golang:1.24-alpine and builds the binary in-place", () => {
    const result = scaffoldService({ serviceName: "api", data, endpoints: [] });
    const dockerfile = String(result.files.find((f) => f.path.endsWith("Dockerfile"))!.content);
    expect(dockerfile).toContain("FROM golang:1.24-alpine");
    expect(dockerfile).toContain("go build -o /usr/local/bin/app ./...");
  });
});
