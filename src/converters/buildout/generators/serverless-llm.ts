/**
 * Serverless generator (bundle-emit).
 *
 * Single-entry variant of service. Adds guidance describing the handler
 * shape and the event-payload schemas to expect based on the trigger
 * plan field.
 */

import { emitBundle } from "../bundle";
import { buildServiceUserPrompt, buildSystemPrompt } from "../prompt";
import type { Generator, GeneratedFile, GeneratorContext } from "../types";

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

export const serverlessLLMGenerator: Generator = {
  kind: "llm",

  supports(ctx) {
    return ctx.node.componentType === "serverless";
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    const lang = ctx.language ?? "node";
    return emitBundle(ctx, {
      systemPrompt: buildSystemPrompt(lang),
      userPrompt: buildServiceUserPrompt(ctx) + SERVERLESS_GUIDANCE,
    });
  },
};
