/**
 * Shared LLM-runner used by service/serverless/cron/webhook/stream
 * generators. They all do the same thing: build prompts, call the LLM,
 * hash, stamp header. Differences are encapsulated in the `userPrompt`
 * caller-builder.
 */

import { buildHeader, sha256Hex } from "../manifest";
import { buildSystemPrompt, languageProfile } from "../prompt";
import type { GeneratedFile, GeneratorContext } from "../types";

export async function runLLMGenerator(
  ctx: GeneratorContext,
  userPromptBuilder: (ctx: GeneratorContext) => string,
): Promise<GeneratedFile[]> {
  if (!ctx.llm) return [];

  const lang = ctx.language ?? "node";
  const system = buildSystemPrompt(lang);
  const user = userPromptBuilder(ctx);

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
}

function prependHeaderIfMissing(contents: string, header: string): string {
  if (contents.startsWith("// flesh-out:") || contents.startsWith("# flesh-out:")) return contents;
  return header + contents;
}
