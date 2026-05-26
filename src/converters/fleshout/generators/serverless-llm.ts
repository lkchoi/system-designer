/**
 * LLM-driven serverless generator.
 *
 * Serverless is a single-entry variant of service. Adds a guidance block
 * to the service user-prompt that pins the output shape to a single
 * handler (no HTTP server boilerplate) and tells the LLM what event
 * shape to expect based on the trigger plan field.
 */

import type { Generator, GeneratorContext, GeneratedFile } from "../types";
import { buildServiceUserPrompt } from "../prompt";
import { runLLMGenerator } from "./_llm-runner";

const SERVERLESS_GUIDANCE = [
  "",
  "<serverless>",
  "This is a serverless function — single entry, no HTTP server boilerplate.",
  "The handler receives an event object whose shape depends on the trigger:",
  " - HTTP: { method, path, headers, query, body }",
  " - S3: { Records: [{ s3: { bucket: { name }, object: { key } } }] }",
  " - SQS / message-queue: { Records: [{ body, messageAttributes }] }",
  " - Schedule / cron: { time, name } (CloudWatch Event shape)",
  "Emit exactly one handler file (export-named or default per language convention) plus its tests.",
  "</serverless>",
].join("\n");

function buildServerlessUserPrompt(ctx: GeneratorContext): string {
  return buildServiceUserPrompt(ctx) + SERVERLESS_GUIDANCE;
}

export const serverlessLLMGenerator: Generator = {
  kind: "llm",

  supports(ctx) {
    return ctx.node.componentType === "serverless" && !!ctx.llm;
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    return runLLMGenerator(ctx, buildServerlessUserPrompt);
  },
};
