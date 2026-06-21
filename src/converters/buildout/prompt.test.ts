import { describe, expect, it } from "vitest";
import { buildServiceUserPrompt, buildSystemPrompt, languageProfile } from "./prompt";
import type { GeneratorContext } from "./types";

function makeCtx(overrides: Partial<GeneratorContext> = {}): GeneratorContext {
  const ctx: GeneratorContext = {
    node: {
      id: "n1",
      label: "Orders Service",
      description: "Accepts new orders, validates inventory, and emits order.placed.",
      componentType: "service",
      plan: { technology: "nodejs", replicas: "3" },
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
    language: "node",
    endpoints: [{ id: "e1", method: "POST", path: "/orders", responseCodes: [201, 400, 409] }],
  };
  return { ...ctx, ...overrides };
}

describe("buildSystemPrompt", () => {
  it("is byte-stable for the same language (caching invariant)", () => {
    const a = buildSystemPrompt("node");
    const b = buildSystemPrompt("node");
    expect(a).toBe(b);
  });

  it("differs across languages", () => {
    expect(buildSystemPrompt("node")).not.toBe(buildSystemPrompt("python"));
    expect(buildSystemPrompt("python")).not.toBe(buildSystemPrompt("go"));
  });

  it("includes the test framework appropriate to the language", () => {
    expect(buildSystemPrompt("node")).toContain("vitest");
    expect(buildSystemPrompt("python")).toContain("pytest");
    expect(buildSystemPrompt("go")).toContain("testing");
  });
});

describe("buildServiceUserPrompt", () => {
  it("includes the description verbatim", () => {
    const out = buildServiceUserPrompt(makeCtx());
    expect(out).toContain("Accepts new orders, validates inventory");
  });

  it("renders endpoints with response codes", () => {
    const out = buildServiceUserPrompt(makeCtx());
    expect(out).toContain("POST /orders");
    expect(out).toContain("responses=[201,400,409]");
  });

  it("renders outbound edges with tech and label", () => {
    const out = buildServiceUserPrompt(
      makeCtx({
        outbound: [
          {
            otherNodeId: "db1",
            otherNodeLabel: "Orders DB",
            otherComponentType: "database",
            otherTechId: "postgresql",
            label: "writes orders",
            protocol: "TCP",
          },
        ],
      }),
    );
    expect(out).toContain("Orders DB");
    expect(out).toContain("postgresql");
    expect(out).toContain("writes orders");
    expect(out).toContain("TCP");
  });

  it("includes merged-slot client metadata", () => {
    const out = buildServiceUserPrompt(
      makeCtx({
        mergedSlots: {
          deps: { pg: "^8.0.0" },
          imports: ["import { Pool } from 'pg'"],
          globals: ["const pool = new Pool(...)"],
          init: [],
          shutdown: [],
          healthChecks: ["() => pool.query('SELECT 1')"],
        },
      }),
    );
    expect(out).toContain("pg ^8.0.0");
    expect(out).toContain("import { Pool } from 'pg'");
    expect(out).toContain("const pool = new Pool");
    expect(out).toContain("() => pool.query");
  });

  it("falls back gracefully when description is empty", () => {
    const ctx = makeCtx();
    ctx.node.description = "";
    const out = buildServiceUserPrompt(ctx);
    expect(out).toContain("no description provided");
  });

  it("emits plan hints (excluding technology)", () => {
    const out = buildServiceUserPrompt(makeCtx());
    expect(out).toContain("replicas: 3");
    expect(out).not.toContain("technology: nodejs");
  });
});

describe("languageProfile", () => {
  it("returns matching comment syntax per language", () => {
    expect(languageProfile("node").commentSyntax).toBe("//");
    expect(languageProfile("python").commentSyntax).toBe("#");
    expect(languageProfile("go").commentSyntax).toBe("//");
  });
});
