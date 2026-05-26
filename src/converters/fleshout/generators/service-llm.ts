/**
 * LLM-driven service generator.
 *
 * Phase 2 deliverable: turn a service node's description (plus its
 * connections and the scaffold-resolved MergedSlots) into handler files
 * and tests via Claude.
 *
 * Falls through if there's no LLM client — the dispatcher will skip and
 * report rather than fail the whole run.
 */

import type { Generator, GeneratorContext, GeneratedFile } from "../types";
import { buildServiceUserPrompt } from "../prompt";
import { runLLMGenerator } from "./_llm-runner";

export const serviceLLMGenerator: Generator = {
  kind: "llm",

  supports(ctx) {
    return ctx.node.componentType === "service" && !!ctx.llm;
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    return runLLMGenerator(ctx, buildServiceUserPrompt);
  },
};
