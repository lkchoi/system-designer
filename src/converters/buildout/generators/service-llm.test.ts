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

  it("falls back to bundle mode for non-Node languages even with endpoints", async () => {
    const c = ctx({ language: "python" }, [
      { id: "e1", method: "POST", path: "/orders", responseCodes: [201] },
    ]);
    const files = await serviceLLMGenerator.generate(c);
    expect(files.find((f) => f.path === "server.ts")).toBeUndefined();
    expect(files.find((f) => f.path === "prompt.md")).toBeTruthy();
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
