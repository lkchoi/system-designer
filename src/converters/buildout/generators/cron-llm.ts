/**
 * Cron job generator (bundle-emit).
 */

import { emitBundle } from "../bundle";
import { buildServiceUserPrompt, buildSystemPrompt } from "../prompt";
import type { Generator, GeneratedFile, GeneratorContext } from "../types";

const CRON_GUIDANCE = [
  "",
  "<cron>",
  "This is a scheduled job. Emit:",
  " 1. A job-body file implementing the work described above.",
  " 2. A scheduler registration in the project's standard format",
  "    (e.g. crontab line, a cron.yaml for Kubernetes CronJob, or a",
  "    cloudformation/serverless framework snippet — pick the most",
  "    appropriate for the language).",
  " 3. Tests for the job body covering happy path + at least one failure mode.",
  "Honor the schedule, timeout, and alertOn hints in <plan-hints>.",
  "The job should be idempotent — repeat invocations on the same schedule",
  "window must not double-process records. Use the outbound clients",
  "listed in <available-clients> for any persistence.",
  "</cron>",
].join("\n");

export const cronLLMGenerator: Generator = {
  kind: "llm",

  supports(ctx) {
    return ctx.node.componentType === "cron";
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    const lang = ctx.language ?? "node";
    return emitBundle(ctx, {
      systemPrompt: buildSystemPrompt(lang),
      userPrompt: buildServiceUserPrompt(ctx) + CRON_GUIDANCE,
    });
  },
};
