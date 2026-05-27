/**
 * Stream-processor generator.
 *
 * Per the plan, this is intended to be a hybrid generator: deterministic
 * operator skeleton from a structured `operations` plan field + LLM
 * bodies for the transform code.
 *
 * **Reality check (v1):** `operations` doesn't exist on the registry yet
 * — that's blocked on the registry-promotion task (see buildout-plan.md).
 * So v1 emits an LLM-only generator with strong guidance for the
 * operator-chain pattern derived from `windowType`, `inputSource`, and
 * `outputSink` plan fields.
 *
 * TODO(hybrid): once `operations` lands on the registry, fork this into
 * a deterministic skeleton-builder + per-operator LLM body calls. The
 * skeleton would be the source/sink wiring and window setup; the LLM
 * would only fill the map/filter/aggregate function bodies. This cuts
 * token spend and reduces nondeterminism for the boilerplate parts.
 */

import type { Generator, GeneratorContext, GeneratedFile } from "../types";
import { buildServiceUserPrompt } from "../prompt";
import { runLLMGenerator } from "./_llm-runner";

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

function buildStreamUserPrompt(ctx: GeneratorContext): string {
  return buildServiceUserPrompt(ctx) + STREAM_GUIDANCE;
}

export const streamLLMGenerator: Generator = {
  kind: "llm",

  supports(ctx) {
    return ctx.node.componentType === "stream-processor" && !!ctx.llm;
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    return runLLMGenerator(ctx, buildStreamUserPrompt);
  },
};
