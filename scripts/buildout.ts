#!/usr/bin/env bun
/**
 * Buildout CLI — dev script.
 *
 * Reads a DesignJSON file, dispatches per-node generators, and writes
 * the produced files under an output directory. For LLM-driven node
 * types (service, serverless, cron, webhook, stream-processor) the
 * "produced files" are a bundle the user runs against their own model.
 *
 * This script is dev-tooling: it's how you smoke-test the buildout
 * pipeline from the terminal. The product surface is the Arkon web UI
 * (which will share the underlying buildOutDesign() call).
 *
 * Usage:
 *   bun run buildout <input.json> [--out <dir>] [--only <type,...>]
 *     [--only-node <id,...>] [--lang node|python|go] [--dry-run]
 *     [--execute]
 *
 * --execute is the only path through this CLI that calls an LLM. It
 * reads ANTHROPIC_API_KEY from env, runs each generated bundle's
 * prompt.md against Claude, and writes the produced files into the
 * bundle folder. Useful for verifying prompts end-to-end without
 * leaving the terminal. NOT part of the product — Arkon itself never
 * executes prompts.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  buildOutDesign,
  type BuildOutOpts,
} from "../src/converters/buildout/index";
import type { ComponentType } from "../src/types";
import type { ScaffoldLang } from "../src/converters/scaffold/concerns/types";

interface Args {
  input?: string;
  out: string;
  only?: ComponentType[];
  onlyNode?: string[];
  language?: ScaffoldLang;
  dryRun: boolean;
  execute: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    out: resolve(process.cwd(), "generated"),
    dryRun: false,
    execute: false,
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
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--execute":
        args.execute = true;
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
      "Usage: bun run buildout <input.json> [options]",
      "",
      "Options:",
      "  --out <dir>            Output directory (default ./generated)",
      "  --only <type,...>      Restrict to componentTypes (e.g. service,database)",
      "  --only-node <id,...>   Restrict to node IDs",
      "  --lang node|python|go  Override default language for compute nodes",
      "  --dry-run              Don't write files, print planned output",
      "  --execute              Dev-only: pipe each bundle's prompt.md through Claude",
      "                         and write the produced files. Requires ANTHROPIC_API_KEY.",
      "  -h, --help             Show this help",
      "",
      "Without --execute, LLM-driven nodes emit a bundle (README.md, prompt.md,",
      "validate.sh) and the user runs the prompt against their preferred tool.",
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

  const opts: BuildOutOpts = {
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

  for (const f of result.files) {
    const target = join(args.out, f.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, f.contents);
  }
  console.log(`Wrote ${result.files.length} files to ${args.out}`);

  if (args.execute) {
    // Dynamic import keeps the Anthropic SDK off the production code
    // path. Only loaded when --execute is passed.
    const { executeBundlesInDir } = await import("../src/converters/buildout/execute-bundles");
    await executeBundlesInDir(args.out, result.files);
  }

  if (result.errors.length) process.exit(2);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
