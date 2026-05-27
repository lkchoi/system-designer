import { describe, expect, it } from "vitest";
import yaml from "js-yaml";
import { openApiGenerator } from "./openapi";
import type { GeneratorContext } from "../types";

function ctx(overrides: Partial<GeneratorContext> = {}): GeneratorContext {
  const base: GeneratorContext = {
    node: {
      id: "gw1",
      label: "Public API",
      description: "External gateway",
      componentType: "api-gateway",
      plan: { technology: "aws-apigw", authMethod: "JWT", rateLimit: "1000 req/min" },
      sharded: false,
      shardKey: "",
      endpoints: [],
      links: [],
      stressFailure: "none",
      capacityPercent: 0,
      consumerRate: 0,
    },
    inbound: [],
    outbound: [],
  };
  return { ...base, ...overrides };
}

describe("openApiGenerator", () => {
  it("emits both YAML and JSON variants", async () => {
    const files = await openApiGenerator.generate(ctx());
    expect(files.map((f) => f.path).sort()).toEqual(["openapi.json", "openapi.yaml"]);
  });

  it("includes JWT bearer security scheme when authMethod=JWT", async () => {
    const [yamlFile] = await openApiGenerator.generate(ctx());
    const parsed = yaml.load(yamlFile.contents) as { components: { securitySchemes: Record<string, { type: string; scheme: string }> } };
    expect(parsed.components.securitySchemes.BearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
  });

  it("creates proxy routes for each downstream service edge", async () => {
    const files = await openApiGenerator.generate(
      ctx({
        outbound: [
          {
            otherNodeId: "s1",
            otherNodeLabel: "Orders Service",
            otherComponentType: "service",
            otherTechId: "nodejs",
          },
          {
            otherNodeId: "s2",
            otherNodeLabel: "Users Service",
            otherComponentType: "service",
            otherTechId: "nodejs",
          },
        ],
      }),
    );
    const spec = JSON.parse(files.find((f) => f.path === "openapi.json")!.contents);
    expect(Object.keys(spec.paths)).toContain("/orders-service/{proxy+}");
    expect(Object.keys(spec.paths)).toContain("/users-service/{proxy+}");
  });

  it("renders explicit endpoints attached to the gateway", async () => {
    const files = await openApiGenerator.generate(
      ctx({
        endpoints: [
          {
            id: "e1",
            method: "POST",
            path: "/login",
            queryParams: [{ name: "rememberMe", required: false }],
            responseCodes: [200, 401],
          },
        ],
      }),
    );
    const spec = JSON.parse(files.find((f) => f.path === "openapi.json")!.contents);
    expect(spec.paths["/login"].post.parameters[0].name).toBe("rememberMe");
    expect(spec.paths["/login"].post.responses["200"]).toBeTruthy();
    expect(spec.paths["/login"].post.responses["401"]).toBeTruthy();
  });

  it("propagates rate limit + CORS as vendor extensions", async () => {
    const files = await openApiGenerator.generate(
      ctx({
        node: {
          ...ctx().node,
          plan: { technology: "aws-apigw", rateLimit: "500/min", cors: "*.example.com" },
        },
      }),
    );
    const spec = JSON.parse(files.find((f) => f.path === "openapi.json")!.contents);
    expect(spec["x-rate-limit"]).toBe("500/min");
    expect(spec["x-cors-allowed-origins"]).toBe("*.example.com");
  });
});
