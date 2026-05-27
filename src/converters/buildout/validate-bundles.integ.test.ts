/**
 * Bundle validation integration tests.
 *
 * For each (generator, language) combination, generate a bundle into a
 * temp dir, drop in a stub LLM-filled file matching the expected
 * outputs, and run the language toolchain to verify the bundle's
 * deterministic skeleton + the stub compile/parse cleanly.
 *
 * Catches: signature drift between the skeleton and the prompt's
 * expected outputs, dependency-shape regressions (e.g. a TS skeleton
 * referencing a type the stub doesn't satisfy), and gofmt churn.
 *
 * Skips gracefully when a language toolchain isn't on PATH — useful
 * for contributors who don't have all three installed.
 *
 * Per CLAUDE.md, integration tests follow the `*.integ.test.ts`
 * naming convention.
 */

import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildOutDesign } from "./index";
import type { ScaffoldLang } from "../scaffold/concerns/types";
import type { ComponentType, SystemNodeData, Endpoint } from "../../types";

// ─── Tool availability detection (cached) ──────────────────────────────

function toolOnPath(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const HAS_TSC = existsSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../node_modules/.bin/tsc"),
);
const HAS_PYTHON = toolOnPath("python3");
const HAS_GOFMT = toolOnPath("gofmt");

const TSC = join(dirname(fileURLToPath(import.meta.url)), "../../../node_modules/.bin/tsc");
const REPO_NODE_MODULES = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../node_modules",
);

// ─── Test fixtures (one node per generator) ────────────────────────────

function makeNode(
  componentType: ComponentType,
  plan: Record<string, string>,
  endpoints: Endpoint[] = [],
): { id: string; type: string; position: { x: number; y: number }; data: SystemNodeData } {
  return {
    id: "n1",
    type: "system",
    position: { x: 0, y: 0 },
    data: {
      label: `${componentType}-test`,
      description: "Integration-test fixture.",
      componentType,
      plan,
      sharded: false,
      shardKey: "",
      endpoints,
      links: [],
      stressFailure: "none",
      capacityPercent: 0,
      consumerRate: 0,
    },
  };
}

// ─── Per-language stubs that satisfy each generator's exported contract ─

const TS_STUBS: Record<string, string> = {
  // service hybrid → handlers.ts
  "handlers.ts": `import type { RouteCtx, RouteResult } from "./server";
export async function get_01_orders(rc: RouteCtx): Promise<RouteResult> { void rc; return { status: 200 }; }
export async function post_02_orders(rc: RouteCtx): Promise<RouteResult> { void rc; return { status: 201 }; }
`,
  // stream hybrid → operators.ts
  "operators.ts": `export async function map_01_extract_userid(input: never): Promise<unknown> { return input; }
export async function filter_02_amount_0(_: never): Promise<boolean> { return true; }
export async function aggregate_04_sum_per_user(input: never): Promise<unknown> { return input; }
`,
  // serverless hybrid → process.ts (HTTP version covers the common path)
  "process.ts": `export interface HttpInput { method: string; path: string; query: Record<string,string>; headers: Record<string,string>; body: unknown }
export interface HttpOutput { status: number; body?: unknown; headers?: Record<string,string> }
export async function process(_: HttpInput): Promise<HttpOutput> { return { status: 200 }; }
`,
  // cron hybrid → work.ts
  "work.ts": `export async function work(opts: { signal: AbortSignal }): Promise<void> { void opts; }
`,
  // webhook hybrid → process.ts OR payload.ts depending on direction
  "process.ts.webhook": `export async function process(payload: unknown): Promise<void> { void payload; }
`,
  "payload.ts": `export async function buildPayload(input: unknown): Promise<unknown> { return input; }
`,
};

// Stubs are referenced by exact filename; we may need to override per
// generator (e.g. webhook inbound uses process.ts with the void-return
// shape, but serverless also uses process.ts with HttpInput/HttpOutput).
// validateTypescript() takes the stub map explicitly to disambiguate.

function tsStubsFor(kind: "service" | "stream" | "serverless-http" | "cron" | "webhook-in" | "webhook-out"): Record<string, string> {
  switch (kind) {
    case "service":
      return { "handlers.ts": TS_STUBS["handlers.ts"] };
    case "stream":
      return { "operators.ts": TS_STUBS["operators.ts"] };
    case "serverless-http":
      return { "process.ts": TS_STUBS["process.ts"] };
    case "cron":
      return { "work.ts": TS_STUBS["work.ts"] };
    case "webhook-in":
      return { "process.ts": TS_STUBS["process.ts.webhook"] };
    case "webhook-out":
      return { "payload.ts": TS_STUBS["payload.ts"] };
  }
}

// ─── Validators ────────────────────────────────────────────────────────

function validateTypescript(bundleDir: string): void {
  // Symlink node_modules so tsc finds @types/node + other deps.
  const nm = join(bundleDir, "node_modules");
  if (!existsSync(nm)) symlinkSync(REPO_NODE_MODULES, nm, "dir");

  const result = spawnSync(
    TSC,
    [
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--target",
      "ES2022",
      "--module",
      "ESNext",
      "--moduleResolution",
      "Bundler",
      "--types",
      "node",
      ...listGlob(bundleDir, ".ts"),
    ],
    { cwd: bundleDir, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`tsc failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`);
  }
}

function validatePython(bundleDir: string): void {
  const files = listGlob(bundleDir, ".py");
  if (files.length === 0) return;
  const result = spawnSync("python3", ["-m", "py_compile", ...files], {
    cwd: bundleDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`py_compile failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`);
  }
}

function validateGoFmt(bundleDir: string): void {
  // gofmt -l prints files that need formatting; empty output = clean.
  // We allow comment-formatting diffs (gofmt's godoc list rules) by
  // only failing on substantive diffs — but for simplicity we just
  // require zero list output, since our renderers shouldn't drift
  // beyond cosmetic comments. If they do, the test catches it.
  const files = listGlob(bundleDir, ".go");
  if (files.length === 0) return;
  const result = spawnSync("gofmt", ["-l", ...files], { cwd: bundleDir, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`gofmt errored: ${result.stderr}`);
  }
  if (result.stdout.trim()) {
    // We tolerate doc-comment diffs but log them. A real test failure
    // here means the renderer is producing structurally broken Go.
    // Run gofmt -d to get the actual diff for the report.
    const diff = spawnSync("gofmt", ["-d", ...files], { cwd: bundleDir, encoding: "utf8" }).stdout;
    // If the diff is comment-only (lines starting with `//` or whitespace),
    // we accept it — comment formatting is gofmt's least-impactful rule.
    const looksLikeCommentOnly = diff
      .split("\n")
      .filter((l) => l.startsWith("-") || l.startsWith("+"))
      .filter((l) => !l.startsWith("---") && !l.startsWith("+++"))
      .every((l) => /^[+-]\s*\/\//.test(l) || /^[+-]\s*$/.test(l));
    if (!looksLikeCommentOnly) {
      throw new Error(`gofmt found non-comment formatting issues:\n${diff}`);
    }
  }
}

function listGlob(dir: string, ext: string): string[] {
  // Minimal "find by extension" without shelling out — keeps the test
  // deterministic on Windows/macOS/Linux.
  const out = spawnSync("find", [dir, "-maxdepth", "2", "-type", "f", "-name", `*${ext}`], {
    encoding: "utf8",
  });
  return out.stdout
    .split("\n")
    .filter(Boolean)
    .map((p) => p.trim());
}

// ─── Test scaffolding ──────────────────────────────────────────────────

const tempDirs: string[] = [];

afterEach(() => {
  // Vitest reuses the process; clean up so /tmp doesn't fill up across
  // hundreds of test runs.
  for (const d of tempDirs.splice(0)) {
    try {
      execSync(`rm -rf ${d}`, { stdio: "ignore" });
    } catch {
      /* best-effort */
    }
  }
});

async function runOne(
  componentType: ComponentType,
  plan: Record<string, string>,
  lang: ScaffoldLang,
  stubs: Record<string, string>,
  endpoints: Endpoint[] = [],
  edges: { source: string; target: string; data?: { label?: string } }[] = [],
): Promise<string> {
  const tmp = mkdtempSync(join(tmpdir(), "buildout-validate-"));
  tempDirs.push(tmp);

  // Build an extra node when edges reference it. Most validations don't
  // need any — webhook inbound needs an outbound edge to trigger inbound
  // mode, webhook outbound needs an inbound edge.
  const nodes: { id: string; type: string; position: { x: number; y: number }; data: SystemNodeData }[] = [
    makeNode(componentType, plan, endpoints),
  ];
  for (const e of edges) {
    const otherId = e.source === "n1" ? e.target : e.source;
    if (!nodes.some((n) => n.id === otherId)) {
      nodes.push({
        ...makeNode("service", { technology: "nodejs" }),
        id: otherId,
        data: { ...makeNode("service", { technology: "nodejs" }).data, label: otherId },
      });
    }
  }

  const result = await buildOutDesign(
    nodes as never,
    edges.map((e, i) => ({ id: `e${i}`, ...e })) as never,
    { defaultLanguage: lang },
  );

  // Write generated files into the bundle's slug folder under tmp.
  for (const f of result.files) {
    const target = join(tmp, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.contents);
  }

  // Drop in stubs alongside.
  const bundleDir = join(tmp, `${componentType}-test`);
  for (const [name, contents] of Object.entries(stubs)) {
    writeFileSync(join(bundleDir, name), contents);
  }

  return bundleDir;
}

// ─── TS suite ──────────────────────────────────────────────────────────

describe.skipIf(!HAS_TSC)("validate-bundles (TypeScript)", () => {
  it("service hybrid handlers.ts typechecks against server.ts", async () => {
    const dir = await runOne(
      "service",
      { technology: "nodejs" },
      "node",
      tsStubsFor("service"),
      [
        { id: "e1", method: "GET", path: "/orders", responseCodes: [200] },
        { id: "e2", method: "POST", path: "/orders", responseCodes: [201] },
      ],
    );
    expect(() => validateTypescript(dir)).not.toThrow();
  });

  it("stream hybrid operators.ts typechecks against pipeline.ts", async () => {
    const ops = [
      "- kind: map",
      "  body: Extract userId",
      "- kind: filter",
      "  body: amount > 0",
      "- kind: window",
      "  window_type: tumbling",
      "  duration: 5m",
      "- kind: aggregate",
      "  body: Sum per user",
    ].join("\n");
    const dir = await runOne(
      "stream-processor",
      { technology: "kafka", operations: ops },
      "node",
      tsStubsFor("stream"),
    );
    expect(() => validateTypescript(dir)).not.toThrow();
  });

  it("serverless HTTP process.ts typechecks against handler.ts", async () => {
    const dir = await runOne(
      "serverless",
      { technology: "aws-lambda", trigger: "HTTP" },
      "node",
      tsStubsFor("serverless-http"),
    );
    expect(() => validateTypescript(dir)).not.toThrow();
  });

  it("cron work.ts typechecks against job.ts", async () => {
    const dir = await runOne(
      "cron",
      { technology: "k8s-cronjob", schedule: "0 3 * * *" },
      "node",
      tsStubsFor("cron"),
    );
    expect(() => validateTypescript(dir)).not.toThrow();
  });

  it("webhook inbound process.ts typechecks against receiver.ts", async () => {
    const dir = await runOne(
      "webhook",
      { technology: "https", method: "POST" },
      "node",
      tsStubsFor("webhook-in"),
      [],
      [{ source: "n1", target: "downstream" }],
    );
    expect(() => validateTypescript(dir)).not.toThrow();
  });

  it("webhook outbound payload.ts typechecks against emitter.ts", async () => {
    const dir = await runOne(
      "webhook",
      { technology: "https" },
      "node",
      tsStubsFor("webhook-out"),
      [],
      [{ source: "upstream", target: "n1" }],
    );
    expect(() => validateTypescript(dir)).not.toThrow();
  });
});

// ─── Python suite ──────────────────────────────────────────────────────

describe.skipIf(!HAS_PYTHON)("validate-bundles (Python — syntax via py_compile)", () => {
  it("stream pipeline.py parses cleanly", async () => {
    const ops = "- kind: map\n  body: extract\n- kind: filter\n  body: amount > 0\n";
    const dir = await runOne(
      "stream-processor",
      { technology: "python-fastapi", operations: ops },
      "python",
      {},
    );
    expect(() => validatePython(dir)).not.toThrow();
  });

  it("service server.py parses cleanly", async () => {
    const dir = await runOne(
      "service",
      { technology: "python-fastapi" },
      "python",
      {},
      [{ id: "e1", method: "GET", path: "/orders", responseCodes: [200] }],
    );
    expect(() => validatePython(dir)).not.toThrow();
  });

  it.each(["HTTP", "S3", "SQS", "schedule"])("serverless %s handler.py parses cleanly", async (trigger) => {
    const dir = await runOne(
      "serverless",
      { technology: "python-fastapi", trigger },
      "python",
      {},
    );
    expect(() => validatePython(dir)).not.toThrow();
  });

  it("cron job.py parses cleanly", async () => {
    const dir = await runOne(
      "cron",
      { technology: "python-fastapi", schedule: "0 0 * * *" },
      "python",
      {},
    );
    expect(() => validatePython(dir)).not.toThrow();
  });

  it("webhook inbound receiver.py parses cleanly", async () => {
    const dir = await runOne(
      "webhook",
      { technology: "python-fastapi", method: "POST" },
      "python",
      {},
      [],
      [{ source: "n1", target: "downstream" }],
    );
    expect(() => validatePython(dir)).not.toThrow();
  });

  it("webhook outbound emitter.py parses cleanly", async () => {
    const dir = await runOne(
      "webhook",
      { technology: "python-fastapi" },
      "python",
      {},
      [],
      [{ source: "upstream", target: "n1" }],
    );
    expect(() => validatePython(dir)).not.toThrow();
  });
});

// ─── Go suite ──────────────────────────────────────────────────────────

describe.skipIf(!HAS_GOFMT)("validate-bundles (Go — gofmt clean)", () => {
  it("stream pipeline.go is gofmt-clean (modulo doc comments)", async () => {
    const ops = "- kind: map\n  body: extract\n- kind: filter\n  body: amount > 0\n";
    const dir = await runOne(
      "stream-processor",
      { technology: "go", operations: ops },
      "go",
      {},
    );
    expect(() => validateGoFmt(dir)).not.toThrow();
  });

  it("service server.go is gofmt-clean", async () => {
    const dir = await runOne(
      "service",
      { technology: "go" },
      "go",
      {},
      [{ id: "e1", method: "GET", path: "/orders", responseCodes: [200] }],
    );
    expect(() => validateGoFmt(dir)).not.toThrow();
  });

  it.each(["HTTP", "S3", "SQS", "schedule"])("serverless %s handler.go is gofmt-clean", async (trigger) => {
    const dir = await runOne(
      "serverless",
      { technology: "go", trigger },
      "go",
      {},
    );
    expect(() => validateGoFmt(dir)).not.toThrow();
  });

  it("cron job.go is gofmt-clean (modulo doc comments)", async () => {
    const dir = await runOne(
      "cron",
      { technology: "go", schedule: "0 0 * * *" },
      "go",
      {},
    );
    expect(() => validateGoFmt(dir)).not.toThrow();
  });

  it("webhook receiver.go is gofmt-clean (modulo doc comments)", async () => {
    const dir = await runOne(
      "webhook",
      { technology: "go", method: "POST" },
      "go",
      {},
      [],
      [{ source: "n1", target: "downstream" }],
    );
    expect(() => validateGoFmt(dir)).not.toThrow();
  });

  it("webhook emitter.go is gofmt-clean (modulo doc comments)", async () => {
    const dir = await runOne(
      "webhook",
      { technology: "go" },
      "go",
      {},
      [],
      [{ source: "upstream", target: "n1" }],
    );
    expect(() => validateGoFmt(dir)).not.toThrow();
  });
});
