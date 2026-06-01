/**
 * Dev-only: run each generated bundle's prompt.md through Claude and
 * write the produced files into the bundle folder.
 *
 * This is **not** part of the product surface. The web UI never imports
 * this file — only `scripts/buildout.ts --execute` does, via a dynamic
 * import. That keeps `@anthropic-ai/sdk` off the bundle/SSR path and
 * preserves the "Arkon never handles your API key" invariant.
 *
 * Purpose: end-to-end smoke testing of prompts in one terminal command,
 * so I (or anyone iterating on prompt content) can see real LLM output
 * without dropping into Claude Code / Cursor / web chat per node.
 *
 * Loading mechanism: dynamic import in scripts/buildout.ts means this
 * module is only resolved at runtime when --execute is passed.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedFile } from "./types";

interface BundleLocation {
  /** Slug folder name (e.g. "orders-service"). */
  slug: string;
  /** Absolute path to the bundle folder. */
  dir: string;
}

/**
 * Find all bundle folders under `outRoot` based on which generators
 * produced a prompt.md (bundles only — deterministic generators don't).
 */
function findBundles(outRoot: string, generated: GeneratedFile[]): BundleLocation[] {
  const slugs = new Set<string>();
  for (const f of generated) {
    if (!f.path.endsWith("/prompt.md")) continue;
    const slug = f.path.split("/")[0];
    slugs.add(slug);
  }
  return [...slugs].map((slug) => ({ slug, dir: join(outRoot, slug) }));
}

const FILES_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          contents: { type: "string" },
        },
        required: ["path", "contents"],
        additionalProperties: false,
      },
    },
  },
  required: ["files"],
  additionalProperties: false,
} as const;

export type ExecuteEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ExecuteOpts {
  /** Max output tokens per bundle. Default 32768. */
  maxTokens?: number;
  /** Per-call wall-clock cap in ms. AbortController-enforced. Default 600_000 (10 min). */
  timeoutMs?: number;
  /** Claude effort level. Default "xhigh". */
  effort?: ExecuteEffort;
  /** Override the model id. Default "claude-opus-4-7". */
  model?: string;
}

const DEFAULT_OPTS: Required<ExecuteOpts> = {
  maxTokens: 32768,
  timeoutMs: 10 * 60 * 1000,
  effort: "xhigh",
  model: "claude-opus-4-7",
};

export async function executeBundlesInDir(
  outRoot: string,
  generated: GeneratedFile[],
  opts: ExecuteOpts = {},
): Promise<void> {
  // Coalesce per-field: the CLI always passes all keys, and they are
  // `undefined` when their flags are omitted. A plain spread would let
  // those `undefined` values clobber DEFAULT_OPTS, so use `??`.
  const cfg: Required<ExecuteOpts> = {
    maxTokens: opts.maxTokens ?? DEFAULT_OPTS.maxTokens,
    timeoutMs: opts.timeoutMs ?? DEFAULT_OPTS.timeoutMs,
    effort: opts.effort ?? DEFAULT_OPTS.effort,
    model: opts.model ?? DEFAULT_OPTS.model,
  };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("--execute requires ANTHROPIC_API_KEY in env. Skipping.");
    return;
  }
  const client = new Anthropic({ apiKey: key });
  const bundles = findBundles(outRoot, generated);

  if (bundles.length === 0) {
    console.log("--execute: no bundles to run (no prompt.md files found).");
    return;
  }

  console.log(
    `--execute: running ${bundles.length} bundle(s) through ${cfg.model} ` +
      `(max_tokens=${cfg.maxTokens}, effort=${cfg.effort}, timeout=${Math.round(cfg.timeoutMs / 1000)}s)…`,
  );

  // Aggregate cost-relevant counters across bundles for the summary line.
  let totalInput = 0;
  let totalCacheRead = 0;
  let totalCacheCreated = 0;
  let totalOutput = 0;
  let timedOut = 0;
  let failed = 0;

  for (const b of bundles) {
    const promptPath = join(b.dir, "prompt.md");
    const prompt = await readFile(promptPath, "utf8");

    process.stdout.write(`  ${b.slug}… `);

    // Wall-clock cap. SDK's HTTP read timeouts reset on each chunk, so
    // we wrap the whole stream in an AbortController to enforce a true
    // deadline. (See claude-api skill notes on robust polling.)
    const ac = new AbortController();
    const deadline = setTimeout(() => ac.abort(), cfg.timeoutMs);

    let message: Awaited<ReturnType<typeof client.messages.stream>> extends infer S
      ? S extends { finalMessage: () => Promise<infer M> }
        ? M
        : never
      : never;
    try {
      const stream = client.messages.stream(
        {
          model: cfg.model,
          max_tokens: cfg.maxTokens,
          thinking: { type: "adaptive" },
          output_config: {
            effort: cfg.effort,
            format: { type: "json_schema", schema: FILES_OUTPUT_SCHEMA },
          },
          messages: [{ role: "user", content: prompt }],
        },
        { signal: ac.signal },
      );
      message = (await stream.finalMessage()) as typeof message;
    } catch (err) {
      clearTimeout(deadline);
      if (ac.signal.aborted) {
        timedOut += 1;
        console.log(`TIMED OUT after ${Math.round(cfg.timeoutMs / 1000)}s`);
      } else {
        failed += 1;
        console.log(`FAILED (${(err as Error).message})`);
      }
      continue;
    }
    clearTimeout(deadline);

    const textBlock = message.content.find(
      (blk): blk is Anthropic.TextBlock => blk.type === "text",
    );
    if (!textBlock) {
      console.log("FAILED (no text block)");
      continue;
    }

    let parsed: { files: { path: string; contents: string }[] };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch (err) {
      console.log(`FAILED (invalid JSON: ${(err as Error).message})`);
      continue;
    }

    let written = 0;
    for (const f of parsed.files) {
      const target = join(b.dir, f.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, f.contents);
      written++;
    }

    const usage = message.usage;
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheCreated = usage.cache_creation_input_tokens ?? 0;
    totalInput += usage.input_tokens;
    totalCacheRead += cacheRead;
    totalCacheCreated += cacheCreated;
    totalOutput += usage.output_tokens;
    console.log(
      `wrote ${written} files ` +
        `(in=${usage.input_tokens} cache_read=${cacheRead} cache_created=${cacheCreated} out=${usage.output_tokens})`,
    );
  }

  // Summary line + crude cost estimate for Opus 4.7 pricing
  // ($5/M input, $25/M output; cache_read at ~0.1×, cache_create at ~1.25×).
  const cost =
    (totalInput / 1_000_000) * 5 +
    (totalCacheRead / 1_000_000) * 0.5 +
    (totalCacheCreated / 1_000_000) * 6.25 +
    (totalOutput / 1_000_000) * 25;
  console.log(
    `summary: in=${totalInput} cache_read=${totalCacheRead} cache_created=${totalCacheCreated} ` +
      `out=${totalOutput} (~$${cost.toFixed(3)}) ` +
      `timed_out=${timedOut} failed=${failed}`,
  );
}
