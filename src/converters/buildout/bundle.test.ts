import { describe, expect, it } from "vitest";
import { emitBundle } from "./bundle";
import type { GeneratorContext } from "./types";

function ctx(overrides: Partial<GeneratorContext> = {}): GeneratorContext {
  return {
    node: {
      id: "n1",
      label: "Orders Service",
      description: "Handles orders.",
      componentType: "service",
      plan: { technology: "nodejs" },
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
    ...overrides,
  };
}

describe("emitBundle", () => {
  it("produces README.md, prompt.md, validate.sh", () => {
    const files = emitBundle(ctx(), { systemPrompt: "SYS", userPrompt: "USER" });
    expect(files.map((f) => f.path).sort()).toEqual([
      "README.md",
      "prompt.md",
      "validate.sh",
    ]);
  });

  it("includes both system and user prompts in prompt.md", () => {
    const files = emitBundle(ctx(), {
      systemPrompt: "SYSTEM-MARKER",
      userPrompt: "USER-MARKER",
    });
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("SYSTEM-MARKER");
    expect(prompt).toContain("USER-MARKER");
  });

  it("lists expected output paths when provided", () => {
    const files = emitBundle(ctx(), {
      systemPrompt: "S",
      userPrompt: "U",
      expectedOutputs: ["src/handlers.ts", "src/handlers.test.ts"],
    });
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("src/handlers.ts");
    expect(prompt).toContain("src/handlers.test.ts");
  });

  it("README references multiple toolchain options (vendor-neutral)", () => {
    const files = emitBundle(ctx(), { systemPrompt: "S", userPrompt: "U" });
    const readme = files.find((f) => f.path === "README.md")!.contents;
    expect(readme).toMatch(/Claude Code/);
    expect(readme).toMatch(/Cursor/);
    expect(readme).toMatch(/OpenAI/);
    expect(readme).toMatch(/Ollama|local/i);
  });

  it("validator picks language-appropriate tooling", () => {
    const nodeFiles = emitBundle(ctx({ language: "node" }), { systemPrompt: "S", userPrompt: "U" });
    expect(nodeFiles.find((f) => f.path === "validate.sh")!.contents).toContain("tsc");

    const pyFiles = emitBundle(ctx({ language: "python" }), { systemPrompt: "S", userPrompt: "U" });
    expect(pyFiles.find((f) => f.path === "validate.sh")!.contents).toContain("compileall");

    const goFiles = emitBundle(ctx({ language: "go" }), { systemPrompt: "S", userPrompt: "U" });
    expect(goFiles.find((f) => f.path === "validate.sh")!.contents).toContain("go vet");
  });
});
