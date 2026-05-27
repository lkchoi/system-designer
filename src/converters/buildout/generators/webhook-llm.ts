/**
 * LLM-driven webhook generator.
 *
 * A `webhook` node represents either:
 *  - **Outbound**: an emitter — your system sends a webhook out to a
 *    third party. Needs signing (HMAC), retry/backoff, an idempotency
 *    key, and a payload schema derived from upstream service edges.
 *  - **Inbound**: a receiver — a third party hits your endpoint. Needs
 *    signature verification, schema validation, and dispatch to the
 *    connected service.
 *
 * Disambiguation: if the webhook has any **outbound** edges, it's an
 * inbound receiver (it routes the call into something else). If it has
 * only **inbound** edges from services/serverless, it's an outbound
 * emitter (services push events into it for delivery).
 *
 * Why this rule: on the canvas, edge direction follows the flow of data
 * (request direction). An inbound receiver receives a third-party
 * request, then dispatches into the system — so the edge from webhook →
 * service models the post-validation dispatch. An outbound emitter
 * receives an internal event (service → webhook) and forwards out.
 *
 * Ambiguous cases (no edges either way) default to outbound emitter —
 * that's the more common "I want to send notifications" intent.
 */

import { emitBundle } from "../bundle";
import { buildServiceUserPrompt, buildSystemPrompt } from "../prompt";
import type { Generator, GeneratedFile, GeneratorContext } from "../types";

const INBOUND_GUIDANCE = [
  "",
  "<webhook-inbound>",
  "This webhook receives HTTP callbacks from a third party.",
  "Emit:",
  " 1. A request handler that:",
  "    - Verifies the signature header (HMAC-SHA256 by convention; the secret",
  "      comes from env, never the request).",
  "    - Validates the payload against an explicit schema. Reject 4xx on shape mismatch.",
  "    - Dispatches the validated payload to the downstream node(s) listed in <outbound-edges>",
  "      using the clients from <available-clients>.",
  "    - Returns 2xx ONLY after the dispatch succeeds (or after the message is durably enqueued).",
  " 2. Tests for: valid signature happy path, invalid signature (401), schema mismatch (400),",
  "    downstream failure (5xx).",
  "Use the URL/method/headers hints from <plan-hints> to shape the endpoint.",
  "Do not return any data the third party could use to enumerate internals.",
  "</webhook-inbound>",
].join("\n");

const OUTBOUND_GUIDANCE = [
  "",
  "<webhook-outbound>",
  "This webhook is an outbound emitter — internal events are forwarded to a remote URL.",
  "Emit:",
  " 1. An emit function that:",
  "    - Signs the payload with HMAC-SHA256 over the request body (secret from env).",
  "    - Includes an idempotency key in a header so retries are safe.",
  "    - Retries on 5xx and network errors with exponential backoff (3 attempts default).",
  "    - Surfaces non-retryable errors (4xx) to the caller without retry.",
  "    - Times out individual attempts at a sensible default (5s).",
  " 2. A message-consumer wrapper if the inbound edge is a queue/topic.",
  " 3. Tests covering: success path, 5xx retry-then-success, 4xx no-retry, timeout.",
  "Use URL/method/headers from <plan-hints>. Never log payloads at info level — they may contain PII.",
  "</webhook-outbound>",
].join("\n");

function isInboundWebhook(ctx: GeneratorContext): boolean {
  // Inbound = has outbound edges (i.e. it dispatches data INTO the system).
  return ctx.outbound.length > 0;
}

export const webhookLLMGenerator: Generator = {
  kind: "llm",

  supports(ctx) {
    return ctx.node.componentType === "webhook";
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    const lang = ctx.language ?? "node";
    const guidance = isInboundWebhook(ctx) ? INBOUND_GUIDANCE : OUTBOUND_GUIDANCE;
    return emitBundle(ctx, {
      systemPrompt: buildSystemPrompt(lang),
      userPrompt: buildServiceUserPrompt(ctx) + guidance,
    });
  },
};
