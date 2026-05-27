#!/usr/bin/env bun
/**
 * Buildout CLI: take a DesignJSON file, generate implementation
 * artifacts per node, write them under an output directory.
 *
 * Usage:
 *   bun run scripts/buildout.ts <input.json> [--out <dir>] [--only <type,...>]
 *     [--only-node <id,...>] [--lang node|python|go] [--no-llm] [--dry-run]
 *
 * Examples:
 *   # Generate everything (services need ANTHROPIC_API_KEY in env):
 *   bun run scripts/buildout.ts my-design.json --out ./generated
 *
 *   # Deterministic-only run — skip LLM-driven nodes (Tier 2 only):
 *   bun run scripts/buildout.ts my-design.json --no-llm
 *
 *   # Just one node type:
 *   bun run scripts/buildout.ts my-design.json --only database,api-gateway
 *
 * Mirrors the shape of scripts/export-design.ts so callers see a
 * consistent CLI style across exporters and buildouts.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  buildOutDesign,
  makeDefaultLLMClient,
  type BuildOutOpts,
} from "../src/converters/buildout/index";
import { shouldRegenerate } from "../src/converters/buildout/manifest";
import type { ComponentType } from "../src/types";
import type { ScaffoldLang } from "../src/converters/scaffold/concerns/types";

interface Args {
  input?: string;
  out: string;
  only?: ComponentType[];
  onlyNode?: string[];
  language?: ScaffoldLang;
  noLLM: boolean;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    out: resolve(process.cwd(), "generated"),
    noLLM: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--out":
        args.out = resolve(argv[++i]);
        break;
      case "--only":
        args.only = argv[++i].split(",").map((s) => s.trim()) as ComponentType[];
        break;
      case "--only-node":
        args.onlyNode = argv[++i].split(",").map((s) => s.trim());
        break;
      case "--lang":
      case "--language": {
        const l = argv[++i];
        if (l !== "node" && l !== "python" && l !== "go") {
          throw new Error(`--lang must be one of node|python|go (got ${l})`);
        }
        args.language = l;
        break;
      }
      case "--no-llm":
        args.noLLM = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "-h":
      case "--help":
        args.help = true;
        break;
      default:
        if (a.startsWith("-")) throw new Error(`Unknown flag: ${a}`);
        if (!args.input) args.input = a;
        else throw new Error(`Unexpected positional arg: ${a}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(
    [
      "Usage: bun run scripts/buildout.ts <input.json> [options]",
      "",
      "Options:",
      "  --out <dir>            Output directory (default ./generated)",
      "  --only <type,...>      Restrict to componentTypes (e.g. service,database)",
      "  --only-node <id,...>   Restrict to node IDs",
      "  --lang node|python|go  Override default language for compute nodes",
      "  --no-llm               Skip LLM-driven generators (Tier 2 only)",
      "  --dry-run              Don't write files, print planned output",
      "  -h, --help             Show this help",
      "",
      "Env: ANTHROPIC_API_KEY enables LLM generators.",
    ].join("\n"),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const json = JSON.parse(await readFile(args.input, "utf8")) as {
    nodes: unknown[];
    edges: unknown[];
    name?: string;
  };
  if (!Array.isArray(json.nodes) || !Array.isArray(json.edges)) {
    throw new Error("Input file is not a DesignJSON (missing nodes/edges).");
  }

  const llm = args.noLLM ? undefined : makeDefaultLLMClient();
  if (!args.noLLM && !llm) {
    console.warn(
      "WARN: ANTHROPIC_API_KEY not set — LLM generators will be skipped.\n" +
        "      Pass --no-llm to silence this and run deterministic generators only.",
    );
  }

  const opts: BuildOutOpts = {
    llm,
    onlyTypes: args.only,
    onlyNodeIds: args.onlyNode,
    defaultLanguage: args.language,
    dryRun: args.dryRun,
  };

  console.log(`Building out ${json.nodes.length} nodes...`);
  const result = await buildOutDesign(
    // We loose-cast here; buildOutDesign validates internally and skips
    // nodes that aren't system nodes (sticky/text/container).
    json.nodes as never,
    json.edges as never,
    opts,
  );

  console.log(`\nGenerated ${result.files.length} files.`);
  if (result.skipped.length) {
    console.log(`Skipped ${result.skipped.length} nodes:`);
    for (const s of result.skipped) console.log(`  - ${s.nodeId}: ${s.reason}`);
  }
  if (result.errors.length) {
    console.log(`Errors on ${result.errors.length} nodes:`);
    for (const e of result.errors) console.log(`  - ${e.nodeId}: ${e.error}`);
  }

  if (args.dryRun) {
    console.log("\n--dry-run: files that would be written:");
    for (const f of result.files) console.log(`  ${join(args.out, f.path)}`);
    process.exit(0);
  }

  // Write files. We do the regenerate check here (CLI level) rather than
  // inside the generator so the LLM call cost is paid only when we
  // actually intend to write. TODO: invert this so we read existing files
  // first, compare hashes against a cheap-to-compute fingerprint of the
  // *inputs*, and skip the LLM call entirely on no-op runs. Requires
  // splitting prompt assembly from generation, which is a Phase 4 task.
  let written = 0;
  let skipped = 0;
  for (const f of result.files) {
    const target = join(args.out, f.path);
    await mkdir(dirname(target), { recursive: true });

    let existing: string | undefined;
    try {
      existing = await readFile(target, "utf8");
    } catch {
      // not present
    }

    if (existing && f.promptHash && !shouldRegenerate(existing, f.promptHash)) {
      skipped++;
      continue;
    }

    await writeFile(target, f.contents);
    written++;
  }

  console.log(`Wrote ${written} files, skipped ${skipped} unchanged.`);
  console.log(`Output: ${args.out}`);
  if (result.errors.length) process.exit(2);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
