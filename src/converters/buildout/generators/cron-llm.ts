/**
 * LLM-driven cron job generator.
 *
 * Cron output:
 * - One job-body file implementing the work described in the node's
 *   `description`.
 * - A small scheduler-registration file (cron.yaml / crontab snippet)
 *   that references the schedule from the plan.
 * - Tests for the job body.
 *
 * The LLM also gets the schedule, timeout, and alertOn hints so it can
 * structure retries and timeouts correctly.
 */

import type { Generator, GeneratorContext, GeneratedFile } from "../types";
import { buildServiceUserPrompt } from "../prompt";
import { runLLMGenerator } from "./_llm-runner";

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

function buildCronUserPrompt(ctx: GeneratorContext): string {
  return buildServiceUserPrompt(ctx) + CRON_GUIDANCE;
}

export const cronLLMGenerator: Generator = {
  kind: "llm",

  supports(ctx) {
    return ctx.node.componentType === "cron" && !!ctx.llm;
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    return runLLMGenerator(ctx, buildCronUserPrompt);
  },
};
