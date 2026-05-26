/**
 * Anthropic LLM client implementation.
 *
 * Decisions:
 * - Model: `claude-opus-4-7`. Per the claude-api skill, Opus 4.7 is the
 *   default; `effort: "xhigh"` is the sweet spot for code generation. We
 *   pair it with adaptive thinking so the model decides how much to
 *   reason per node.
 * - Structured outputs via `output_config.format` with a JSON Schema so
 *   the response is guaranteed to parse as `{files: [{path, contents}]}`.
 *   This replaces the older prefill technique (removed on Opus 4.7).
 * - Prompt caching: we mark the system prompt with `cache_control` so the
 *   same system text is paid for once per cache TTL (~5 min default).
 *   Volatile per-node content goes in the user message after the cache
 *   breakpoint, so it doesn't invalidate the prefix.
 * - We stream to avoid SDK HTTP timeouts on large outputs (max_tokens up
 *   to 64K). The streamed response is collected via `stream.finalMessage()`.
 *
 * Tradeoff: Opus 4.7 is expensive (~$5/$25 per 1M in/out). For Tier 2
 * deterministic generators we don't call the LLM at all. For Tier 1, the
 * generated handlers are typically <200 lines so the per-node cost is
 * small ($0.10–$0.50 range). Cost capping is left to the CLI level as a
 * TODO — see fleshout-plan.md "LLM budget".
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient } from "./types";
import type { ScaffoldLang } from "../scaffold/concerns/types";

export interface AnthropicLLMOpts {
  /** API key. Defaults to env var ANTHROPIC_API_KEY (SDK default). */
  apiKey?: string;
  /** Override model. Default: claude-opus-4-7. */
  model?: string;
  /** Override effort. Default: "xhigh" (best for code generation per skill guidance). */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Override max_tokens. Default: 32768. */
  maxTokens?: number;
}

/** JSON Schema for the files-output contract. */
const FILES_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path with no leading slash" },
          contents: { type: "string", description: "Full file text" },
        },
        required: ["path", "contents"],
        additionalProperties: false,
      },
    },
  },
  required: ["files"],
  additionalProperties: false,
} as const;

export function makeAnthropicLLMClient(opts: AnthropicLLMOpts = {}): LLMClient {
  const client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  const model = opts.model ?? "claude-opus-4-7";
  const effort = opts.effort ?? "xhigh";
  const maxTokens = opts.maxTokens ?? 32768;

  return {
    async completeFiles({ system, user, language }) {
      // Stream to avoid HTTP timeouts on large outputs; finalMessage()
      // gives us the assembled Message after the stream completes.
      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        // Adaptive thinking is the right setting for code generation —
        // the model decides per-prompt how much to think.
        thinking: { type: "adaptive" },
        output_config: {
          effort,
          format: {
            type: "json_schema",
            schema: FILES_OUTPUT_SCHEMA,
          },
        },
        system: [
          // Stable, cacheable prefix. Putting cache_control here means
          // multiple node-generations in one run share the system tokens.
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: user }],
      });

      const message = await stream.finalMessage();

      // Extract the JSON-output content block. With output_config.format,
      // the response includes a single block of type "text" containing the
      // structured JSON string.
      const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      if (!textBlock) {
        throw new Error(
          `LLM returned no text block. stop_reason=${message.stop_reason}. ` +
            `Content types: ${message.content.map((b) => b.type).join(", ")}`,
        );
      }

      let parsed: { files: { path: string; contents: string }[] };
      try {
        parsed = JSON.parse(textBlock.text);
      } catch (err) {
        throw new Error(
          `LLM returned invalid JSON despite structured-output constraint. ` +
            `First 200 chars: ${textBlock.text.slice(0, 200)}. ` +
            `Underlying: ${(err as Error).message}`,
        );
      }

      if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
        throw new Error(`LLM returned no files. Raw response: ${textBlock.text.slice(0, 500)}`);
      }

      // language is currently unused by this client but is part of the
      // LLMClient contract for future provider-specific tuning.
      void language;

      return {
        files: parsed.files,
        promptText: `system:${system}\nuser:${user}`,
      };
    },
  };
}

/**
 * Convenience: build an Anthropic-backed LLMClient with sensible defaults
 * for service-style code generation, or `undefined` if no API key is
 * available.
 */
export function makeDefaultLLMClient(): LLMClient | undefined {
  // process is Node-only; guard for browser builds.
  const key =
    typeof process !== "undefined" && process.env?.ANTHROPIC_API_KEY
      ? process.env.ANTHROPIC_API_KEY
      : undefined;
  if (!key) return undefined;
  return makeAnthropicLLMClient({ apiKey: key });
}

// Silence "unused" lint for ScaffoldLang import in environments where the
// type is erased — kept on the import line for future use.
export type _Lang = ScaffoldLang;
