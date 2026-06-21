import { describe, expect, it } from "vitest";
import { streamLLMGenerator } from "./stream-llm";
import type { GeneratorContext } from "../types";

function ctx(overrides: Partial<GeneratorContext> = {}): GeneratorContext {
  return {
    node: {
      id: "sp1",
      label: "Orders Stream",
      description: "Process order events and aggregate by user.",
      componentType: "stream-processor",
      plan: { technology: "kafka" },
      sharded: false,
      shardKey: "",
      endpoints: [],
      links: [],
      stressFailure: "none",
      capacityPercent: 0,
      consumerRate: 0,
    },
    inbound: [
      {
        otherNodeId: "src",
        otherNodeLabel: "orders-topic",
        otherComponentType: "message-queue",
        otherTechId: "kafka",
      },
    ],
    outbound: [
      {
        otherNodeId: "sink",
        otherNodeLabel: "metrics-db",
        otherComponentType: "database",
        otherTechId: "postgresql",
      },
    ],
    language: "node",
    ...overrides,
  };
}

describe("streamLLMGenerator — fallback bundle mode", () => {
  it("emits a single bundle when operations is absent", async () => {
    const files = await streamLLMGenerator.generate(ctx());
    expect(files.map((f) => f.path).sort()).toEqual([
      "README.md",
      "prompt.md",
      "validate.sh",
    ]);
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("populate `plan.operations`");
  });

  it("emits the same bundle when operations YAML is malformed", async () => {
    const c = ctx();
    c.node.plan = { ...c.node.plan, operations: "this: is: : not valid" };
    const files = await streamLLMGenerator.generate(c);
    expect(files.find((f) => f.path === "pipeline.ts")).toBeUndefined();
    expect(files.find((f) => f.path === "prompt.md")).toBeTruthy();
  });

});

describe("streamLLMGenerator — hybrid mode", () => {
  function hybridCtx() {
    const c = ctx();
    c.node.plan = {
      ...c.node.plan,
      operations: [
        "- kind: map",
        "  body: Extract userId from event",
        "- kind: filter",
        "  body: amount > 0",
        "- kind: window",
        "  window_type: tumbling",
        "  duration: 5m",
        "- kind: aggregate",
        "  body: Sum amount per userId",
      ].join("\n"),
    };
    return c;
  }

  it("emits a deterministic pipeline.ts plus a bundle", async () => {
    const files = await streamLLMGenerator.generate(hybridCtx());
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "pipeline.ts", "prompt.md", "validate.sh"]);
  });

  it("pipeline.ts imports operator functions from operators.ts", async () => {
    const files = await streamLLMGenerator.generate(hybridCtx());
    const pipeline = files.find((f) => f.path === "pipeline.ts")!.contents;
    expect(pipeline).toContain('from "./operators";');
    expect(pipeline).toMatch(/map_01/);
    expect(pipeline).toMatch(/filter_02/);
    expect(pipeline).toMatch(/aggregate_04/);
    // Window operators stay deterministic — no operator function.
    expect(pipeline).not.toMatch(/window_03/);
  });

  it("pipeline.ts materializes window buffer with the right duration", async () => {
    const files = await streamLLMGenerator.generate(hybridCtx());
    const pipeline = files.find((f) => f.path === "pipeline.ts")!.contents;
    expect(pipeline).toContain("window1_buffer");
    expect(pipeline).toContain("window1_ms = 300000"); // 5m
  });

  it("pipeline.ts wires inbound + outbound edge labels into TODO markers", async () => {
    const files = await streamLLMGenerator.generate(hybridCtx());
    const pipeline = files.find((f) => f.path === "pipeline.ts")!.contents;
    expect(pipeline).toContain("orders-topic");
    expect(pipeline).toContain("metrics-db");
  });

  it("bundle prompt references the skeleton + lists operators to implement", async () => {
    const files = await streamLLMGenerator.generate(hybridCtx());
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("<hybrid-skeleton>");
    expect(prompt).toContain("operators.ts");
    expect(prompt).toContain("do NOT regenerate");
    expect(prompt).toContain("map_01");
    expect(prompt).toContain("filter_02");
    expect(prompt).toContain("aggregate_04");
    // Embeds the pipeline source so the LLM matches signatures.
    expect(prompt).toContain('from "./operators";');
  });
});

describe("streamLLMGenerator — hybrid mode (Python)", () => {
  function pyCtx() {
    const c = ctx({ language: "python" });
    c.node.plan = {
      ...c.node.plan,
      operations: [
        "- kind: map",
        "  body: Extract userId",
        "- kind: filter",
        "  body: amount > 0",
        "- kind: window",
        "  window_type: tumbling",
        "  duration: 2m",
        "- kind: aggregate",
        "  body: Sum per user",
      ].join("\n"),
    };
    return c;
  }

  it("emits pipeline.py + Python operators bundle", async () => {
    const files = await streamLLMGenerator.generate(pyCtx());
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "pipeline.py", "prompt.md", "validate.sh"]);
  });

  it("pipeline.py imports from operators module, uses asyncio, and materializes the window", async () => {
    const files = await streamLLMGenerator.generate(pyCtx());
    const py = files.find((f) => f.path === "pipeline.py")!.contents;
    expect(py).toContain("import asyncio");
    expect(py).toMatch(/from operators import map_01_extract_userid, filter_02_amount_0, aggregate_04_sum_per_user/);
    expect(py).toContain('if __name__ == "__main__":');
    expect(py).toContain("_window1_seconds = 120");
    // Filter / map dispatch shape.
    expect(py).toContain("if not await filter_02_amount_0(value):");
    expect(py).toContain("value = await map_01_extract_userid(value)");
  });

  it("prompt fences the source as python and references test_operators.py", async () => {
    const files = await streamLLMGenerator.generate(pyCtx());
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("```python");
    expect(prompt).toContain("operators.py");
    expect(prompt).toContain("test_operators.py");
    expect(prompt).toContain("async def name");
  });
});

describe("streamLLMGenerator — hybrid mode (Go)", () => {
  function goCtx() {
    const c = ctx({ language: "go" });
    c.node.plan = {
      ...c.node.plan,
      operations: [
        "- kind: map",
        "  body: Extract userId",
        "- kind: filter",
        "  body: amount > 0",
        "- kind: window",
        "  window_type: tumbling",
        "  duration: 30s",
        "- kind: aggregate",
        "  body: Sum per user",
      ].join("\n"),
    };
    return c;
  }

  it("emits pipeline.go + Go operators bundle", async () => {
    const files = await streamLLMGenerator.generate(goCtx());
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "pipeline.go", "prompt.md", "validate.sh"]);
  });

  it("pipeline.go declares package stream, uses channels, exports operator names", async () => {
    const files = await streamLLMGenerator.generate(goCtx());
    const go = files.find((f) => f.path === "pipeline.go")!.contents;
    expect(go).toContain("package stream");
    expect(go).toContain("type Event = any");
    expect(go).toContain("func Run(ctx context.Context) error");
    expect(go).toContain("<-chan Event");
    expect(go).toContain("window1Duration = 30 * time.Second");
    // Operator names are exported (capitalized).
    expect(go).toContain("Map_01_extract_userid");
    expect(go).toContain("Filter_02_amount_0");
    expect(go).toContain("Aggregate_04_sum_per_user");
  });

  it("prompt fences source as go and references operators_test.go", async () => {
    const files = await streamLLMGenerator.generate(goCtx());
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("```go");
    expect(prompt).toContain("operators.go");
    expect(prompt).toContain("operators_test.go");
    expect(prompt).toContain("func name(in Event)");
  });
});
