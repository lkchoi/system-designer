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
import { buildServiceUserPrompt, buildSystemPrompt, languageProfile } from "../prompt";
import { buildHeader, sha256Hex } from "../manifest";

export const serviceLLMGenerator: Generator = {
  kind: "llm",

  supports(ctx) {
    return ctx.node.componentType === "service" && !!ctx.llm;
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    if (!ctx.llm) return [];

    const lang = ctx.language ?? "node";
    const system = buildSystemPrompt(lang);
    const user = buildServiceUserPrompt(ctx);

    const { files, promptText } = await ctx.llm.completeFiles({
      system,
      user,
      language: lang,
    });

    const promptHash = await sha256Hex(promptText);
    const prof = languageProfile(lang);
    const header = buildHeader(promptHash, prof.commentSyntax);

    return files.map((f) => ({
      path: f.path,
      contents: prependHeaderIfMissing(f.contents, header),
      promptHash,
    }));
  },
};

function prependHeaderIfMissing(contents: string, header: string): string {
  // Avoid double-stamping if the LLM happened to emit its own header.
  if (contents.startsWith("// flesh-out:") || contents.startsWith("# flesh-out:")) return contents;
  return header + contents;
}
