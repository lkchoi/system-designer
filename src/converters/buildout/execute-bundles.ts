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

export async function executeBundlesInDir(
  outRoot: string,
  generated: GeneratedFile[],
): Promise<void> {
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

  console.log(`--execute: running ${bundles.length} bundle(s) through claude-opus-4-7…`);

  for (const b of bundles) {
    const promptPath = join(b.dir, "prompt.md");
    const prompt = await readFile(promptPath, "utf8");

    process.stdout.write(`  ${b.slug}… `);
    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 32768,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "xhigh",
        format: { type: "json_schema", schema: FILES_OUTPUT_SCHEMA },
      },
      messages: [{ role: "user", content: prompt }],
    });
    const message = await stream.finalMessage();

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
    console.log(
      `wrote ${written} files ` +
        `(in=${usage.input_tokens} cache_read=${cacheRead} cache_created=${cacheCreated} out=${usage.output_tokens})`,
    );
  }
}
