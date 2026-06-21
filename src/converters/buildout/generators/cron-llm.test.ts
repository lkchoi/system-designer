import { describe, expect, it } from "vitest";
import { cronLLMGenerator } from "./cron-llm";
import type { GeneratorContext } from "../types";

function ctx(plan: Record<string, string>, overrides: Partial<GeneratorContext> = {}): GeneratorContext {
  return {
    node: {
      id: "c1",
      label: "Nightly Cleanup",
      description: "Purge expired sessions.",
      componentType: "cron",
      plan: { technology: "k8s-cronjob", ...plan },
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

describe("cronLLMGenerator — hybrid (Python)", () => {
  it("emits job.py + cronjob.yaml + work bundle", async () => {
    const files = await cronLLMGenerator.generate(ctx({ schedule: "0 3 * * *", timeout: "5m" }, { language: "python" }));
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "cronjob.yaml", "job.py", "prompt.md", "validate.sh"]);
  });

  it("job.py uses asyncio.wait_for + exits 2 on timeout, 1 on failure", async () => {
    const files = await cronLLMGenerator.generate(ctx({ schedule: "*/5 * * * *", timeout: "30s" }, { language: "python" }));
    const py = files.find((f) => f.path === "job.py")!.contents;
    expect(py).toContain("asyncio.wait_for(work(), timeout=TIMEOUT_S)");
    expect(py).toContain("sys.exit(2)");
    expect(py).toContain("sys.exit(1)");
    expect(py).toContain('JOB_TIMEOUT_S", "30')
    expect(py).toContain('if __name__ == "__main__":');
  });

  it("cronjob.yaml command points at python job.py for Python builds", async () => {
    const files = await cronLLMGenerator.generate(ctx({ schedule: "0 0 * * *" }, { language: "python" }));
    const y = files.find((f) => f.path === "cronjob.yaml")!.contents;
    expect(y).toContain('command: ["python", "job.py"]');
  });

  it("prompt asks for work.py with async def signature", async () => {
    const files = await cronLLMGenerator.generate(ctx({ schedule: "0 3 * * *" }, { language: "python" }));
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("```python");
    expect(prompt).toContain("async def work");
    expect(prompt).toContain("work.py");
    expect(prompt).toContain("test_work.py");
  });
});

describe("cronLLMGenerator — hybrid (Go)", () => {
  it("emits job.go + cronjob.yaml + work bundle", async () => {
    const files = await cronLLMGenerator.generate(ctx({ schedule: "0 0 * * *", timeout: "5m" }, { language: "go" }));
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "cronjob.yaml", "job.go", "prompt.md", "validate.sh"]);
  });

  it("job.go uses context.WithTimeout + os.Exit(2) on DeadlineExceeded", async () => {
    const files = await cronLLMGenerator.generate(ctx({ schedule: "*/15 * * * *", timeout: "60s" }, { language: "go" }));
    const go = files.find((f) => f.path === "job.go")!.contents;
    expect(go).toContain("package main");
    expect(go).toContain("context.WithTimeout");
    expect(go).toContain("DeadlineExceeded");
    expect(go).toContain("os.Exit(1)");
    expect(go).toContain("os.Exit(2)");
    expect(go).toContain("Work(ctx)");
    expect(go).toContain("timeoutSeconds := 60");
  });

  it("cronjob.yaml command runs ./job for Go builds", async () => {
    const files = await cronLLMGenerator.generate(ctx({ schedule: "0 0 * * *" }, { language: "go" }));
    const y = files.find((f) => f.path === "cronjob.yaml")!.contents;
    expect(y).toContain('command: ["./job"]');
  });

  it("prompt asks for Work(ctx) signature in work.go", async () => {
    const files = await cronLLMGenerator.generate(ctx({ schedule: "0 3 * * *" }, { language: "go" }));
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("```go");
    expect(prompt).toContain("func Work(ctx context.Context) error");
    expect(prompt).toContain("work.go");
    expect(prompt).toContain("work_test.go");
  });
});

describe("cronLLMGenerator — hybrid (Node)", () => {
  it("emits job.ts + cronjob.yaml + work bundle", async () => {
    const files = await cronLLMGenerator.generate(ctx({ schedule: "0 3 * * *", timeout: "10m" }));
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "cronjob.yaml", "job.ts", "prompt.md", "validate.sh"]);
  });

  it("job.ts wires AbortController-based timeout, distinguishes timeout (exit 2) vs failure (exit 1)", async () => {
    const files = await cronLLMGenerator.generate(ctx({ schedule: "*/5 * * * *", timeout: "30s" }));
    const job = files.find((f) => f.path === "job.ts")!.contents;
    expect(job).toContain('import { work } from "./work";');
    expect(job).toContain("AbortController");
    expect(job).toContain("process.exit(1)");
    expect(job).toContain("process.exit(2)");
    expect(job).toContain("30000"); // 30s in ms
  });

  it("cronjob.yaml pins the schedule and activeDeadlineSeconds from plan", async () => {
    const files = await cronLLMGenerator.generate(ctx({ schedule: "0 */6 * * *", timeout: "5m" }));
    const y = files.find((f) => f.path === "cronjob.yaml")!.contents;
    expect(y).toContain("kind: CronJob");
    expect(y).toContain('schedule: "0 */6 * * *"');
    expect(y).toContain("activeDeadlineSeconds: 300");
    expect(y).toContain("concurrencyPolicy: Forbid");
    expect(y).toContain("name: nightly-cleanup");
  });

  it("falls back to default schedule + timeout when plan fields are absent", async () => {
    const files = await cronLLMGenerator.generate(ctx({}));
    const y = files.find((f) => f.path === "cronjob.yaml")!.contents;
    expect(y).toContain('schedule: "0 0 * * *"');
    expect(y).toContain("activeDeadlineSeconds: 300");
  });

  it("prompt asks for work.ts only and embeds the job source", async () => {
    const files = await cronLLMGenerator.generate(ctx({ schedule: "0 3 * * *" }));
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("<hybrid-skeleton>");
    expect(prompt).toContain("work.ts");
    expect(prompt).toContain("do NOT regenerate job.ts");
    expect(prompt).toContain("export async function work");
    expect(prompt).toContain("AbortSignal");
    expect(prompt).toContain("AbortController"); // embedded job source
  });

  it("parses timeout in minutes and hours correctly", async () => {
    const files = await cronLLMGenerator.generate(ctx({ timeout: "1h" }));
    const y = files.find((f) => f.path === "cronjob.yaml")!.contents;
    expect(y).toContain("activeDeadlineSeconds: 3600");
  });
});
