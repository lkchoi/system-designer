/**
 * Stream-processor generator — hybrid.
 *
 * Two modes, selected by whether `plan.operations` (YAML) is populated:
 *
 * ## Hybrid mode (operations present)
 * Emits TWO artifacts:
 *  1. `pipeline.<ext>` — DETERMINISTIC skeleton that wires source →
 *     operator chain → sink, with explicit `operators.<name>(event)`
 *     call sites for each non-window step. Window operators are
 *     materialized as inline buffer/tumble logic (no LLM needed).
 *  2. A bundle (`README.md` + `prompt.md` + `validate.sh`) that asks
 *     the LLM to produce `operators.<ext>` exporting one focused
 *     function per non-window operation. The prompt embeds the
 *     skeleton source so the LLM sees the exact signatures to fill.
 *
 * Why the split: the boilerplate (source/sink wiring, window math,
 * checkpointing, DLQ routing) is mechanical and deterministic given
 * the structured operations field. The non-trivial parts are the
 * map/filter/aggregate function bodies — focused enough to prompt
 * for individually, small enough that the LLM rarely gets them wrong.
 *
 * ## Bundle-only fallback (operations missing/empty)
 * Backward-compatible with designs that haven't filled in the
 * structured operations field. Emits the same single bundle as before
 * the hybrid split.
 *
 * Current scope: Node/TypeScript skeleton only. Python and Go follow
 * the same shape — TODO when needed.
 */

import yaml from "js-yaml";
import { emitBundle } from "../bundle";
import { buildServiceUserPrompt, buildSystemPrompt, languageProfile } from "../prompt";
import type { ScaffoldLang } from "../../scaffold/concerns/types";
import type { Generator, GeneratedFile, GeneratorContext } from "../types";

type OpKind = "map" | "filter" | "window" | "aggregate";

interface Operation {
  kind: OpKind;
  body?: string;
  window_type?: "tumbling" | "sliding";
  duration?: string;
}

const FALLBACK_GUIDANCE = [
  "",
  "<stream-processor>",
  "This is a stream-processing pipeline. Emit:",
  " 1. The processor implementation as a chain of typed operators",
  "    (map / filter / window / aggregate). Make each operator a small,",
  "    independently testable function.",
  " 2. Source + sink wiring using the input/output edges from <outbound-edges>",
  "    and <inbound-edges>. Use the matching clients in <available-clients>.",
  " 3. Window setup honoring the windowType in <plan-hints>",
  "    (tumbling = fixed bucket; sliding = overlapping window with step).",
  " 4. Checkpoint handling at the cadence given by the checkpointing hint —",
  "    do not invent a cadence if absent; default to per-message commit.",
  " 5. A dead-letter handler for messages that fail the transform N times",
  "    (default N=3). Route to a DLQ topic or log + drop, based on the sink edge.",
  " 6. Tests covering: single-record happy path, window boundary, DLQ trigger.",
  "Do NOT block in the operator bodies — use streaming/iterator semantics for the language.",
  "</stream-processor>",
  "",
  "Tip: populate `plan.operations` (structured YAML in the canvas widget)",
  "to switch this node to hybrid generation — the skeleton becomes",
  "deterministic and only operator bodies need to be filled in.",
].join("\n");

export const streamLLMGenerator: Generator = {
  kind: "hybrid",

  supports(ctx) {
    return ctx.node.componentType === "stream-processor";
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    const lang = ctx.language ?? "node";
    const operations = parseOperations(ctx.node.plan?.operations);

    if (!operations || operations.length === 0) {
      // Fallback: single bundle, today's behavior.
      return emitBundle(ctx, {
        systemPrompt: buildSystemPrompt(lang),
        userPrompt: buildServiceUserPrompt(ctx) + FALLBACK_GUIDANCE,
      });
    }

    return emitHybrid(ctx, operations);
  },
};

function parseOperations(raw: string | undefined): Operation[] | undefined {
  if (!raw || !raw.trim()) return undefined;
  try {
    const parsed = yaml.load(raw);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(
      (p): p is Operation =>
        typeof p === "object" && p !== null && typeof (p as Operation).kind === "string",
    );
  } catch {
    return undefined;
  }
}

/**
 * Hybrid path: deterministic pipeline.ts + a bundle that asks the LLM
 * to fill in operators.ts with a function per non-window operation.
 */
function emitHybrid(ctx: GeneratorContext, operations: Operation[]): GeneratedFile[] {
  const lang = ctx.language ?? "node";
  const operatorFns = operations
    .map((op, idx) => ({ op, idx, name: operatorFnName(op, idx) }))
    .filter((x) => x.op.kind !== "window");

  const renderer = PIPELINE_RENDERERS[lang];
  const pipeline = renderer(ctx, operations, operatorFns);
  const pipelinePath = pipelineFilename(lang);
  const expectedOperatorPaths = operatorOutputPaths(lang);
  const fenceLang = pipelineFenceLang(lang);

  const operatorPrompt = buildOperatorPrompt(
    ctx,
    operatorFns,
    pipeline,
    pipelinePath,
    expectedOperatorPaths,
    fenceLang,
  );
  const bundle = emitBundle(ctx, {
    systemPrompt: buildSystemPrompt(lang),
    userPrompt: operatorPrompt,
    expectedOutputs: expectedOperatorPaths,
  });

  return [{ path: pipelinePath, contents: pipeline }, ...bundle];
}

type PipelineRenderer = (
  ctx: GeneratorContext,
  operations: Operation[],
  operatorFns: OperatorRef[],
) => string;

const PIPELINE_RENDERERS: Record<ScaffoldLang, PipelineRenderer> = {
  node: (ctx, ops, fns) => renderPipelineTs(ctx, ops, fns),
  python: (ctx, ops, fns) => renderPipelinePython(ctx, ops, fns),
  go: (ctx, ops, fns) => renderPipelineGo(ctx, ops, fns),
};

function pipelineFilename(lang: ScaffoldLang): string {
  return `pipeline.${languageProfile(lang).ext}`;
}

function operatorOutputPaths(lang: ScaffoldLang): string[] {
  // Test file naming follows the language's standard convention. Falling
  // back to languageProfile.testExt would give us `operators.test.py` /
  // `operators._test.go`, which isn't idiomatic — explicit per-language
  // here.
  switch (lang) {
    case "node":
      return ["operators.ts", "operators.test.ts"];
    case "python":
      return ["operators.py", "test_operators.py"];
    case "go":
      return ["operators.go", "operators_test.go"];
  }
}

function pipelineFenceLang(lang: ScaffoldLang): string {
  switch (lang) {
    case "node":
      return "ts";
    case "python":
      return "python";
    case "go":
      return "go";
  }
}

function operatorFnName(op: Operation, idx: number): string {
  const base = (op.body ?? op.kind)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${op.kind}_${String(idx + 1).padStart(2, "0")}${base ? `_${base}` : ""}`;
}

interface OperatorRef {
  op: Operation;
  idx: number;
  name: string;
}

/**
 * Emit the pipeline.ts skeleton:
 *  - imports from operators.ts (LLM-filled)
 *  - source iterator placeholder
 *  - operator chain that calls each non-window operator by name
 *  - window operators materialized inline as buffer + flush
 *  - sink call placeholder
 *  - top-level loop with checkpoint / DLQ scaffold
 */
function renderPipelineTs(
  ctx: GeneratorContext,
  operations: Operation[],
  operatorFns: OperatorRef[],
): string {
  const inSource = ctx.inbound[0]?.otherNodeLabel ?? "(no inbound edge)";
  const outSink = ctx.outbound[0]?.otherNodeLabel ?? "(no outbound edge)";

  const importNames = operatorFns.map((f) => f.name).join(", ");
  const lines: string[] = [];

  lines.push(`// Stream pipeline for "${ctx.node.label}".`);
  lines.push(`// Skeleton generated by Arkon buildout (deterministic).`);
  lines.push(`// Operator function bodies are LLM-generated — see operators.ts.`);
  lines.push(``);
  lines.push(`// TODO: replace these with the real source/sink clients from your setup.`);
  lines.push(`//   Inbound:  ${inSource}`);
  lines.push(`//   Outbound: ${outSink}`);
  lines.push(``);
  if (operatorFns.length > 0) {
    lines.push(`import { ${importNames} } from "./operators";`);
    lines.push(``);
  }

  lines.push(`type Event = unknown; // refine to your domain type`);
  lines.push(``);
  lines.push(`/** Iterate the source — replace with a real consumer. */`);
  lines.push(`async function* source(): AsyncIterable<Event> {`);
  lines.push(`  // TODO: wire to ${inSource}`);
  lines.push(`  return;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`/** Emit to the sink. */`);
  lines.push(`async function sink(value: unknown): Promise<void> {`);
  lines.push(`  // TODO: wire to ${outSink}`);
  lines.push(`  void value;`);
  lines.push(`}`);
  lines.push(``);

  // Look ahead for window operators so we can declare buffers up top.
  const windows = operations.filter((o) => o.kind === "window");
  for (let wi = 0; wi < windows.length; wi++) {
    const w = windows[wi];
    lines.push(
      `// Window ${wi + 1}: ${w.window_type ?? "tumbling"} ${w.duration ?? "5m"} — emits batches via flushWindow${wi + 1}()`,
    );
    lines.push(`const window${wi + 1}_buffer: Event[] = [];`);
    lines.push(
      `const window${wi + 1}_ms = ${durationMs(w.duration ?? "5m")}; // ${w.duration ?? "5m"}`,
    );
    lines.push(`let window${wi + 1}_start = Date.now();`);
    lines.push(``);
  }

  lines.push(`const MAX_RETRIES = 3;`);
  lines.push(`async function deadLetter(event: Event, err: unknown): Promise<void> {`);
  lines.push(`  // TODO: route to DLQ topic or persistent store.`);
  lines.push(`  console.error("DLQ", { event, err });`);
  lines.push(`}`);
  lines.push(``);

  lines.push(`export async function run(): Promise<void> {`);
  lines.push(`  for await (const event of source()) {`);
  lines.push(`    let attempts = 0;`);
  lines.push(`    while (attempts < MAX_RETRIES) {`);
  lines.push(`      try {`);
  lines.push(`        let value: unknown = event;`);

  let windowSeen = 0;
  for (const op of operations) {
    if (op.kind === "window") {
      windowSeen += 1;
      lines.push(`        // ── window ${windowSeen} (${op.window_type ?? "tumbling"} ${op.duration ?? "5m"}) ──`);
      lines.push(`        window${windowSeen}_buffer.push(value as Event);`);
      lines.push(`        if (Date.now() - window${windowSeen}_start >= window${windowSeen}_ms) {`);
      lines.push(`          const batch = window${windowSeen}_buffer.splice(0);`);
      lines.push(`          window${windowSeen}_start = Date.now();`);
      lines.push(`          value = batch;`);
      lines.push(`        } else {`);
      lines.push(`          break; // not yet — wait for next event`);
      lines.push(`        }`);
      continue;
    }

    const fn = operatorFns.find((f) => f.idx === operations.indexOf(op))?.name;
    if (!fn) continue;

    if (op.kind === "filter") {
      lines.push(`        if (!(await ${fn}(value as never))) break;`);
    } else {
      lines.push(`        value = await ${fn}(value as never);`);
    }
  }

  lines.push(`        await sink(value);`);
  lines.push(`        break;`);
  lines.push(`      } catch (err) {`);
  lines.push(`        attempts += 1;`);
  lines.push(`        if (attempts >= MAX_RETRIES) await deadLetter(event, err);`);
  lines.push(`      }`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`if (import.meta.url === \`file://\${process.argv[1]}\`) {`);
  lines.push(`  run().catch((err) => {`);
  lines.push(`    console.error(err);`);
  lines.push(`    process.exit(1);`);
  lines.push(`  });`);
  lines.push(`}`);

  return lines.join("\n") + "\n";
}

function buildOperatorPrompt(
  ctx: GeneratorContext,
  operatorFns: OperatorRef[],
  pipelineSrc: string,
  pipelinePath: string,
  expectedOutputs: string[],
  fenceLang: string,
): string {
  const [operatorsFile, operatorsTestFile] = expectedOutputs;
  const lang = ctx.language ?? "node";
  const baseUserPrompt = buildServiceUserPrompt(ctx);
  const lines: string[] = [];
  lines.push(baseUserPrompt);
  lines.push("");
  lines.push("<hybrid-skeleton>");
  lines.push(
    `The stream pipeline skeleton (\`${pipelinePath}\`) is already generated. ` +
      `It calls into \`${operatorsFile}\` for each map/filter/aggregate step. ` +
      `Your job is to write ONLY \`${operatorsFile}\` (plus \`${operatorsTestFile}\`) — ` +
      `do NOT regenerate \`${pipelinePath}\`.`,
  );
  lines.push("");
  lines.push(`Here is the \`${pipelinePath}\` you must match:`);
  lines.push("```" + fenceLang);
  lines.push(pipelineSrc.trimEnd());
  lines.push("```");
  lines.push("");
  lines.push(`Operator functions to implement (in \`${operatorsFile}\`):`);
  for (const f of operatorFns) {
    lines.push(`- \`${f.name}\` — kind=${f.op.kind}, body: ${f.op.body ?? "(unspecified)"}`);
  }
  lines.push("");
  lines.push("Rules:");
  lines.push(...operatorRules(lang, operatorsFile, operatorsTestFile, pipelinePath));
  lines.push("</hybrid-skeleton>");

  return lines.join("\n");
}

function operatorRules(
  lang: ScaffoldLang,
  operatorsFile: string,
  operatorsTestFile: string,
  pipelinePath: string,
): string[] {
  const common = [
    ` - Match the function signatures called from \`${pipelinePath}\` exactly.`,
    ` - Do not introduce side effects (logging, sinks). \`${pipelinePath}\` handles that.`,
    ` - Tests in \`${operatorsTestFile}\` cover happy + edge for each operator.`,
  ];
  switch (lang) {
    case "node":
      return [
        " - Each operator is a small pure async function: `async (input: T) => U` (or `=> boolean` for filter).",
        ` - Export each by name from \`${operatorsFile}\`.`,
        ...common,
      ];
    case "python":
      return [
        " - Each operator is a small pure async function: `async def name(value) -> ...` (return `bool` for filter).",
        ` - Define each at module level in \`${operatorsFile}\`.`,
        ...common,
      ];
    case "go":
      return [
        " - Each operator is a small pure function with the signature shown in the skeleton:",
        "   `func name(in Event) (Event, error)` for map/aggregate, `func name(in Event) bool` for filter.",
        ` - Export each (capital-letter prefix) from package \`stream\` in \`${operatorsFile}\`.`,
        ...common,
      ];
  }
}

function durationMs(duration: string): number {
  const m = duration.match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return 5 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || "m").toLowerCase();
  const factor = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return n * factor;
}

function durationSeconds(duration: string): number {
  return Math.max(1, Math.round(durationMs(duration) / 1000));
}

/**
 * Python pipeline skeleton.
 *
 * Uses asyncio + async generators. Operator functions live in
 * `operators.py` and are imported by name. Window state is held in
 * module-level lists for parity with the TS implementation.
 *
 * Tradeoff: we don't try to detect aiokafka/faust/etc.; the source/sink
 * are `async def` stubs the user wires to their consumer/producer.
 */
function renderPipelinePython(
  ctx: GeneratorContext,
  operations: Operation[],
  operatorFns: OperatorRef[],
): string {
  const inSource = ctx.inbound[0]?.otherNodeLabel ?? "(no inbound edge)";
  const outSink = ctx.outbound[0]?.otherNodeLabel ?? "(no outbound edge)";
  const windows = operations.filter((o) => o.kind === "window");

  const lines: string[] = [];
  lines.push(`"""Stream pipeline for "${ctx.node.label}".`);
  lines.push(``);
  lines.push(`Skeleton generated by Arkon buildout (deterministic).`);
  lines.push(`Operator function bodies are LLM-generated — see operators.py.`);
  lines.push(``);
  lines.push(`TODO: replace the source/sink stubs with real consumer/producer wiring.`);
  lines.push(`  Inbound:  ${inSource}`);
  lines.push(`  Outbound: ${outSink}`);
  lines.push(`"""`);
  lines.push(``);
  lines.push(`import asyncio`);
  lines.push(`import time`);
  lines.push(`from typing import Any, AsyncIterator`);
  if (operatorFns.length > 0) {
    lines.push(`from operators import ${operatorFns.map((f) => f.name).join(", ")}`);
  }
  lines.push(``);
  lines.push(`MAX_RETRIES = 3`);
  lines.push(``);

  for (let wi = 0; wi < windows.length; wi++) {
    const w = windows[wi];
    lines.push(
      `# Window ${wi + 1}: ${w.window_type ?? "tumbling"} ${w.duration ?? "5m"} — flushed as a list batch`,
    );
    lines.push(`_window${wi + 1}_buffer: list[Any] = []`);
    lines.push(
      `_window${wi + 1}_seconds = ${durationSeconds(w.duration ?? "5m")}  # ${w.duration ?? "5m"}`,
    );
    lines.push(`_window${wi + 1}_start = time.monotonic()`);
    lines.push(``);
  }

  lines.push(`async def source() -> AsyncIterator[Any]:`);
  lines.push(`    """Iterate the source — replace with a real consumer."""`);
  lines.push(`    # TODO: wire to ${inSource}`);
  lines.push(`    if False:`);
  lines.push(`        yield None  # generator type marker; remove when wired`);
  lines.push(``);
  lines.push(`async def sink(value: Any) -> None:`);
  lines.push(`    """Emit to the sink."""`);
  lines.push(`    # TODO: wire to ${outSink}`);
  lines.push(`    _ = value`);
  lines.push(``);
  lines.push(`async def dead_letter(event: Any, err: Exception) -> None:`);
  lines.push(`    # TODO: route to DLQ topic or persistent store.`);
  lines.push(`    print("DLQ", {"event": event, "err": repr(err)})`);
  lines.push(``);
  lines.push(`async def run() -> None:`);
  lines.push(`    global ${windows.map((_, i) => `_window${i + 1}_start`).join(", ") || "_"}`);
  lines.push(`    async for event in source():`);
  lines.push(`        attempts = 0`);
  lines.push(`        while attempts < MAX_RETRIES:`);
  lines.push(`            try:`);
  lines.push(`                value: Any = event`);

  let windowSeen = 0;
  for (const op of operations) {
    if (op.kind === "window") {
      windowSeen += 1;
      lines.push(
        `                # ── window ${windowSeen} (${op.window_type ?? "tumbling"} ${op.duration ?? "5m"}) ──`,
      );
      lines.push(`                _window${windowSeen}_buffer.append(value)`);
      lines.push(
        `                if time.monotonic() - _window${windowSeen}_start >= _window${windowSeen}_seconds:`,
      );
      lines.push(`                    batch = list(_window${windowSeen}_buffer)`);
      lines.push(`                    _window${windowSeen}_buffer.clear()`);
      lines.push(`                    _window${windowSeen}_start = time.monotonic()`);
      lines.push(`                    value = batch`);
      lines.push(`                else:`);
      lines.push(`                    break  # not yet — wait for next event`);
      continue;
    }
    const fn = operatorFns.find((f) => f.idx === operations.indexOf(op))?.name;
    if (!fn) continue;
    if (op.kind === "filter") {
      lines.push(`                if not await ${fn}(value):`);
      lines.push(`                    break`);
    } else {
      lines.push(`                value = await ${fn}(value)`);
    }
  }

  lines.push(`                await sink(value)`);
  lines.push(`                break`);
  lines.push(`            except Exception as err:`);
  lines.push(`                attempts += 1`);
  lines.push(`                if attempts >= MAX_RETRIES:`);
  lines.push(`                    await dead_letter(event, err)`);
  lines.push(``);
  lines.push(`if __name__ == "__main__":`);
  lines.push(`    asyncio.run(run())`);
  return lines.join("\n") + "\n";
}

/**
 * Go pipeline skeleton.
 *
 * Uses channels for source/sink and assumes operators live in the same
 * `package stream`. Exported function names start with an uppercase
 * letter; we rewrite the operator name's first character accordingly
 * (`map_01_extract_userid` → `Map_01_extract_userid`) so the import-free
 * cross-file reference works.
 *
 * Filter/map/aggregate signatures are uniform:
 *   func Name(in Event) (Event, error)       // map, aggregate
 *   func Name(in Event) bool                 // filter
 *
 * Window math runs inline in Run() with a time.Time per window.
 */
function renderPipelineGo(
  ctx: GeneratorContext,
  operations: Operation[],
  operatorFns: OperatorRef[],
): string {
  const inSource = ctx.inbound[0]?.otherNodeLabel ?? "(no inbound edge)";
  const outSink = ctx.outbound[0]?.otherNodeLabel ?? "(no outbound edge)";
  const windows = operations.filter((o) => o.kind === "window");
  const exportedName = (s: string) => s[0].toUpperCase() + s.slice(1);

  const lines: string[] = [];
  lines.push(`// Package stream — pipeline for "${ctx.node.label}".`);
  lines.push(`//`);
  lines.push(`// Skeleton generated by Arkon buildout (deterministic).`);
  lines.push(`// Operator function bodies are LLM-generated — see operators.go.`);
  lines.push(`//`);
  lines.push(`// TODO: replace the source/sink stubs with real consumer/producer wiring.`);
  lines.push(`//   Inbound:  ${inSource}`);
  lines.push(`//   Outbound: ${outSink}`);
  lines.push(`package stream`);
  lines.push(``);
  lines.push(`import (`);
  lines.push(`	"context"`);
  lines.push(`	"log"`);
  lines.push(`	"time"`);
  lines.push(`)`);
  lines.push(``);
  lines.push(`// Event is the message type flowing through the pipeline.`);
  lines.push(`// Refine to your domain type.`);
  lines.push(`type Event = any`);
  lines.push(``);
  lines.push(`const maxRetries = 3`);
  lines.push(``);

  for (let wi = 0; wi < windows.length; wi++) {
    const w = windows[wi];
    lines.push(
      `// Window ${wi + 1}: ${w.window_type ?? "tumbling"} ${w.duration ?? "5m"} — flushed as a slice batch`,
    );
    lines.push(`var window${wi + 1}Buffer []Event`);
    lines.push(`var window${wi + 1}Duration = ${durationSeconds(w.duration ?? "5m")} * time.Second`);
    lines.push(`var window${wi + 1}Start = time.Now()`);
    lines.push(``);
  }

  lines.push(`// source emits events. Replace with your real consumer.`);
  lines.push(`func source(ctx context.Context) <-chan Event {`);
  lines.push(`	out := make(chan Event)`);
  lines.push(`	go func() {`);
  lines.push(`		defer close(out)`);
  lines.push(`		// TODO: wire to ${inSource}`);
  lines.push(`		_ = ctx`);
  lines.push(`	}()`);
  lines.push(`	return out`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`// sink emits to the destination. Replace with your real producer.`);
  lines.push(`func sink(value any) error {`);
  lines.push(`	// TODO: wire to ${outSink}`);
  lines.push(`	_ = value`);
  lines.push(`	return nil`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`func deadLetter(event Event, err error) {`);
  lines.push(`	// TODO: route to DLQ topic or persistent store.`);
  lines.push(`	log.Printf("DLQ: event=%v err=%v", event, err)`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`// Run drains the source through the operator chain into the sink.`);
  lines.push(`func Run(ctx context.Context) error {`);
  lines.push(`	for event := range source(ctx) {`);
  lines.push(`		attempts := 0`);
  lines.push(`		for attempts < maxRetries {`);
  lines.push(`			err := func() error {`);
  lines.push(`				var value Event = event`);
  lines.push(`				var opErr error`);

  let windowSeen = 0;
  for (const op of operations) {
    if (op.kind === "window") {
      windowSeen += 1;
      lines.push(
        `				// ── window ${windowSeen} (${op.window_type ?? "tumbling"} ${op.duration ?? "5m"}) ──`,
      );
      lines.push(`				window${windowSeen}Buffer = append(window${windowSeen}Buffer, value)`);
      lines.push(
        `				if time.Since(window${windowSeen}Start) >= window${windowSeen}Duration {`,
      );
      lines.push(`					batch := append([]Event(nil), window${windowSeen}Buffer...)`);
      lines.push(`					window${windowSeen}Buffer = window${windowSeen}Buffer[:0]`);
      lines.push(`					window${windowSeen}Start = time.Now()`);
      lines.push(`					value = batch`);
      lines.push(`				} else {`);
      lines.push(`					return nil  // not yet — wait for next event`);
      lines.push(`				}`);
      continue;
    }
    const fn = operatorFns.find((f) => f.idx === operations.indexOf(op))?.name;
    if (!fn) continue;
    const exported = exportedName(fn);
    if (op.kind === "filter") {
      lines.push(`				if !${exported}(value) {`);
      lines.push(`					return nil`);
      lines.push(`				}`);
    } else {
      lines.push(`				value, opErr = ${exported}(value)`);
      lines.push(`				if opErr != nil {`);
      lines.push(`					return opErr`);
      lines.push(`				}`);
    }
  }

  lines.push(`				return sink(value)`);
  lines.push(`			}()`);
  lines.push(`			if err == nil {`);
  lines.push(`				break`);
  lines.push(`			}`);
  lines.push(`			attempts++`);
  lines.push(`			if attempts >= maxRetries {`);
  lines.push(`				deadLetter(event, err)`);
  lines.push(`			}`);
  lines.push(`		}`);
  lines.push(`	}`);
  lines.push(`	return nil`);
  lines.push(`}`);

  return lines.join("\n") + "\n";
}
