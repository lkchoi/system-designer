#!/usr/bin/env bun
/**
 * CLI mirror of the in-app Export dialog: take a DesignState JSON file and
 * write the file(s) the converter would otherwise stream through the browser.
 *
 * Usage:
 *   bun run scripts/export-design.ts <input.json> --format <id> [--out <dir>] [--prefer-localstack]
 *   bun run scripts/export-design.ts --list-formats
 *
 * Format ids match the tiles in the dialog: native-json, excalidraw,
 * cloudformation, terraform, kubernetes, aws-cdk, pulumi, docker-compose,
 * nomad, localstack.
 *
 * --prefer-localstack maps to the dialog checkbox; only docker-compose reads it.
 *
 * The barrel src/converters/index.ts re-exports native-json, which value-imports
 * src/db/io → src/db/database → a Vite-only `sql-wasm.wasm?url` and won't load
 * outside Vite. We import each exporter directly and inline the trivial
 * native-json export to dodge that chain.
 */
import { writeFile, mkdir, readFile, access } from "node:fs/promises";
import { resolve, join } from "node:path";

import type { ConverterModule, ExportResult, FormatId } from "../src/converters/types.ts";
import type { DesignJSON } from "../src/db/io.ts";

import { excalidrawConverter } from "../src/converters/excalidraw.ts";
import { cloudformationConverter } from "../src/converters/cloudformation.ts";
import { terraformConverter } from "../src/converters/terraform.ts";
import { kubernetesConverter } from "../src/converters/kubernetes.ts";
import { awsCdkConverter } from "../src/converters/aws-cdk.ts";
import { pulumiConverter } from "../src/converters/pulumi.ts";
import { dockerComposeConverter } from "../src/converters/docker-compose.ts";
import { nomadConverter } from "../src/converters/nomad.ts";
import { localstackConverter } from "../src/converters/localstack.ts";

// Inlined to avoid the db/io → sql.js?url chain. Mirrors native-json.ts.
const nativeJsonConverter: ConverterModule = {
  id: "native-json",
  label: "JSON",
  description: "Native format with full fidelity",
  category: "diagram",
  fileExtensions: [".json"],
  canImport: true,
  exportDesign(design: DesignJSON) {
    return {
      content: JSON.stringify(design, null, 2),
      filename: `${design.name}.json`,
      mimeType: "application/json",
    };
  },
};

const CONVERTERS: ConverterModule[] = [
  nativeJsonConverter,
  excalidrawConverter,
  cloudformationConverter,
  terraformConverter,
  kubernetesConverter,
  awsCdkConverter,
  pulumiConverter,
  dockerComposeConverter,
  nomadConverter,
  localstackConverter,
];

interface Args {
  input?: string;
  format?: FormatId;
  out: string;
  preferLocalStack: boolean;
  listFormats: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    out: process.cwd(),
    preferLocalStack: false,
    listFormats: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list-formats") args.listFormats = true;
    else if (a === "-h" || a === "--help") args.help = true;
    else if (a === "--prefer-localstack") args.preferLocalStack = true;
    else if (a === "-f" || a === "--format") args.format = argv[++i] as FormatId;
    else if (a === "-o" || a === "--out") args.out = argv[++i];
    else if (!a.startsWith("-") && !args.input) args.input = a;
    else die(`unknown argument: ${a}`);
  }
  return args;
}

function die(msg: string): never {
  console.error(`error: ${msg}`);
  console.error("Run with --help for usage.");
  process.exit(1);
}

function printHelp(): void {
  console.log(`Export a DesignState JSON via any of the in-app converters.

Usage:
  bun run scripts/export-design.ts <input.json> --format <id> [--out <dir>] [--prefer-localstack]
  bun run scripts/export-design.ts --list-formats

Options:
  -f, --format <id>        Format id (see --list-formats)
  -o, --out <dir>          Output directory (default: cwd)
      --prefer-localstack  Inject LocalStack for AWS services (docker-compose only)
      --list-formats       List available format ids
  -h, --help               Show this help`);
}

function listFormats(): void {
  const w = Math.max(...CONVERTERS.map((c) => c.id.length));
  console.log("Available formats:\n");
  for (const c of CONVERTERS) {
    console.log(`  ${c.id.padEnd(w)}  ${c.label} — ${c.description}`);
  }
}

function parseDesign(raw: string): DesignJSON {
  const parsed = JSON.parse(raw);
  if (typeof parsed.version !== "number") die("input JSON missing numeric `version`");
  if (!Array.isArray(parsed.nodes)) die("input JSON missing array `nodes`");
  if (!Array.isArray(parsed.edges)) die("input JSON missing array `edges`");
  return {
    version: parsed.version,
    name: typeof parsed.name === "string" && parsed.name ? parsed.name : "Imported Design",
    nodes: parsed.nodes,
    edges: parsed.edges,
    viewport: parsed.viewport ?? { x: 0, y: 0, zoom: 1 },
    flowPaths: Array.isArray(parsed.flowPaths) ? parsed.flowPaths : [],
  };
}

async function writeOutput(result: ExportResult, outDir: string): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, result.filename);
  if (result.content instanceof Blob) {
    const buf = Buffer.from(await result.content.arrayBuffer());
    await writeFile(path, buf);
  } else {
    await writeFile(path, result.content, "utf-8");
  }
  return path;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (args.listFormats) return listFormats();
  if (!args.input) die("missing positional input file");
  if (!args.format) die("missing --format (try --list-formats)");

  const converter = CONVERTERS.find((c) => c.id === args.format);
  if (!converter) die(`unknown format: ${args.format}`);

  const inputPath = resolve(args.input);
  try {
    await access(inputPath);
  } catch {
    die(`input file not found: ${inputPath}`);
  }
  const design = parseDesign(await readFile(inputPath, "utf-8"));

  const result = await converter.exportDesign(design, { preferLocalStack: args.preferLocalStack });
  const written = await writeOutput(result, resolve(args.out));
  console.log(`wrote ${written}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
