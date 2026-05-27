/**
 * Service generator (bundle-emit).
 *
 * Turns a service node's description, connections, and scaffold-resolved
 * MergedSlots into a build bundle the user runs against their LLM of
 * choice. See `../bundle.ts` for the layout.
 */

import { emitBundle } from "../bundle";
import { buildServiceUserPrompt, buildSystemPrompt } from "../prompt";
import type { Generator, GeneratedFile, GeneratorContext } from "../types";

export const serviceLLMGenerator: Generator = {
  kind: "llm",

  supports(ctx) {
    return ctx.node.componentType === "service";
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    const lang = ctx.language ?? "node";
    return emitBundle(ctx, {
      systemPrompt: buildSystemPrompt(lang),
      userPrompt: buildServiceUserPrompt(ctx),
    });
  },
};
