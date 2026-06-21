import { describe, expect, it } from "vitest";
import { serviceLLMGenerator } from "./service-llm";
import type { Endpoint } from "../../../types";
import type { GeneratorContext } from "../types";

function ctx(overrides: Partial<GeneratorContext> = {}, endpoints: Endpoint[] = []): GeneratorContext {
  return {
    node: {
      id: "svc1",
      label: "Orders Service",
      description: "Accept orders.",
      componentType: "service",
      plan: { technology: "nodejs" },
      sharded: false,
      shardKey: "",
      endpoints,
      links: [],
      stressFailure: "none",
      capacityPercent: 0,
      consumerRate: 0,
    },
    inbound: [],
    outbound: [],
    language: "node",
    endpoints,
    ...overrides,
  };
}

describe("serviceLLMGenerator — fallback bundle mode", () => {
  it("emits a single bundle when no endpoints are declared", async () => {
    const files = await serviceLLMGenerator.generate(ctx());
    expect(files.map((f) => f.path).sort()).toEqual(["README.md", "prompt.md", "validate.sh"]);
  });

});

describe("serviceLLMGenerator — hybrid mode (TS)", () => {
  function hybridCtx() {
    return ctx({}, [
      { id: "e1", method: "GET", path: "/orders", responseCodes: [200, 401] },
      {
        id: "e2",
        method: "POST",
        path: "/orders",
        queryParams: [{ name: "userId", required: true }],
        responseCodes: [201, 400, 409],
      },
      { id: "e3", method: "DELETE", path: "/orders/:id", responseCodes: [204, 404] },
    ]);
  }

  it("emits server.ts plus the handlers bundle", async () => {
    const files = await serviceLLMGenerator.generate(hybridCtx());
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "prompt.md", "server.ts", "validate.sh"]);
  });

  it("server.ts imports each handler and registers one route per endpoint", async () => {
    const files = await serviceLLMGenerator.generate(hybridCtx());
    const server = files.find((f) => f.path === "server.ts")!.contents;
    expect(server).toContain('from "./handlers";');
    expect(server).toMatch(/get_01_orders/);
    expect(server).toMatch(/post_02_orders/);
    expect(server).toMatch(/delete_03_orders_id/);
    expect(server).toContain(`"GET /orders"`);
    expect(server).toContain(`"POST /orders"`);
    expect(server).toContain(`"DELETE /orders/:id"`);
  });

  it("server.ts has a 404 fall-through and 500 error path", async () => {
    const files = await serviceLLMGenerator.generate(hybridCtx());
    const server = files.find((f) => f.path === "server.ts")!.contents;
    expect(server).toContain('status: 404');
    expect(server).toContain('"not_found"');
    expect(server).toContain('"internal_error"');
  });

  it("server.ts uses node:http with no extra deps", async () => {
    const files = await serviceLLMGenerator.generate(hybridCtx());
    const server = files.find((f) => f.path === "server.ts")!.contents;
    expect(server).toContain('from "node:http"');
    // No express/fastify/koa imports.
    expect(server).not.toMatch(/express|fastify|koa/);
  });

  it("prompt references server.ts + lists each handler with method/path/query/responses", async () => {
    const files = await serviceLLMGenerator.generate(hybridCtx());
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("<hybrid-skeleton>");
    expect(prompt).toContain("server.ts");
    expect(prompt).toContain("handlers.ts");
    expect(prompt).toContain("do NOT");
    expect(prompt).toContain("get_01_orders");
    expect(prompt).toContain("POST /orders");
    expect(prompt).toContain("query=[userId]");
    expect(prompt).toContain("responses=[201,400,409]");
    // Embeds the skeleton source.
    expect(prompt).toContain("RouteCtx");
  });
});

describe("serviceLLMGenerator — hybrid mode (Python)", () => {
  function pyCtx() {
    return ctx({ language: "python" }, [
      { id: "e1", method: "GET", path: "/orders", responseCodes: [200, 401] },
      { id: "e2", method: "POST", path: "/orders", responseCodes: [201, 400] },
    ]);
  }

  it("emits server.py + Python handlers bundle", async () => {
    const files = await serviceLLMGenerator.generate(pyCtx());
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "prompt.md", "server.py", "validate.sh"]);
  });

  it("server.py uses FastAPI + Pydantic and registers one route per endpoint", async () => {
    const files = await serviceLLMGenerator.generate(pyCtx());
    const py = files.find((f) => f.path === "server.py")!.contents;
    expect(py).toContain("from fastapi import FastAPI");
    expect(py).toContain("from pydantic import BaseModel");
    expect(py).toContain("class RouteCtx(BaseModel):");
    expect(py).toContain("class RouteResult(BaseModel):");
    expect(py).toContain("app = FastAPI()");
    expect(py).toContain('@app.get("/orders")');
    expect(py).toContain('@app.post("/orders")');
    expect(py).toMatch(/get_01_orders/);
    expect(py).toMatch(/post_02_orders/);
    expect(py).toContain('if __name__ == "__main__":');
  });

  it("prompt fences source as python and references test_handlers.py", async () => {
    const files = await serviceLLMGenerator.generate(pyCtx());
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("```python");
    expect(prompt).toContain("handlers.py");
    expect(prompt).toContain("test_handlers.py");
    expect(prompt).toContain("async def name");
  });
});

describe("serviceLLMGenerator — hybrid mode (Go)", () => {
  function goCtx() {
    return ctx({ language: "go" }, [
      { id: "e1", method: "GET", path: "/orders", responseCodes: [200] },
      { id: "e2", method: "DELETE", path: "/orders/:id", responseCodes: [204, 404] },
    ]);
  }

  it("emits server.go + Go handlers bundle", async () => {
    const files = await serviceLLMGenerator.generate(goCtx());
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "prompt.md", "server.go", "validate.sh"]);
  });

  it("server.go declares package server, uses net/http ServeMux, exports handlers", async () => {
    const files = await serviceLLMGenerator.generate(goCtx());
    const go = files.find((f) => f.path === "server.go")!.contents;
    expect(go).toContain("package server");
    expect(go).toContain('"net/http"');
    expect(go).toContain("type RouteCtx struct {");
    expect(go).toContain("type RouteResult struct {");
    expect(go).toContain("func Register(mux *http.ServeMux)");
    // Handler names exported (capitalized).
    expect(go).toMatch(/Get_01_orders/);
    expect(go).toMatch(/Delete_02_orders_id/);
    // Routes registered with method+path syntax (Go 1.22+ ServeMux).
    expect(go).toContain('"GET /orders"');
    expect(go).toContain('"DELETE /orders/:id"');
  });

  it("prompt fences source as go and references handlers_test.go", async () => {
    const files = await serviceLLMGenerator.generate(goCtx());
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("```go");
    expect(prompt).toContain("handlers.go");
    expect(prompt).toContain("handlers_test.go");
    expect(prompt).toContain("func Name(rc *RouteCtx)");
  });
});
