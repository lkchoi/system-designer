/**
 * Stream-processor generator (bundle-emit).
 *
 * v1 is LLM-only: the user runs the bundle's prompt against their model
 * of choice. The hybrid deterministic-skeleton + LLM-body design from
 * the plan remains blocked on a structured `operations` plan field; see
 * .context/buildout-plan.md (Registry changes).
 */

import { emitBundle } from "../bundle";
import { buildServiceUserPrompt, buildSystemPrompt } from "../prompt";
import type { Generator, GeneratedFile, GeneratorContext } from "../types";

const STREAM_GUIDANCE = [
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
].join("\n");

export const streamLLMGenerator: Generator = {
  kind: "llm",

  supports(ctx) {
    return ctx.node.componentType === "stream-processor";
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    const lang = ctx.language ?? "node";
    return emitBundle(ctx, {
      systemPrompt: buildSystemPrompt(lang),
      userPrompt: buildServiceUserPrompt(ctx) + STREAM_GUIDANCE,
    });
  },
};
