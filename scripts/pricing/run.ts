#!/usr/bin/env npx tsx
/**
 * Pricing data fetcher — runs all fetcher modules and regenerates
 * src/registry/pricing.ts with the latest pricing data.
 *
 * Usage:
 *   npx tsx scripts/pricing/run.ts                  # run all fetchers
 *   npx tsx scripts/pricing/run.ts --only aws,azure # run specific fetchers
 *   npx tsx scripts/pricing/run.ts --list           # list available fetchers
 *   npx tsx scripts/pricing/run.ts --dry-run        # fetch but don't write
 */
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FetchResult } from "./types.ts";
import { FETCHERS } from "./fetchers/index.ts";
import { generatePricingFile } from "./generate.ts";
import { log, warn } from "./utils.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, ".cache");

// ── CLI argument parsing ────────────────────────────────────────────────────

const args = process.argv.slice(2);

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

function getFlagValue(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // --list: show available fetchers and exit
  if (hasFlag("--list")) {
    console.log("\nAvailable fetchers:\n");
    for (const [name, f] of Object.entries(FETCHERS)) {
      console.log(`  ${name.padEnd(16)} ${f.description} (${f.technologies.length} technologies)`);
    }
    console.log(
      `\nTotal: ${Object.values(FETCHERS).reduce((n, f) => n + f.technologies.length, 0)} technologies\n`,
    );
    return;
  }

  const dryRun = hasFlag("--dry-run");
  const onlyRaw = getFlagValue("--only");
  const selectedNames = onlyRaw ? onlyRaw.split(",").map((s) => s.trim()) : Object.keys(FETCHERS);

  // Validate fetcher names
  for (const name of selectedNames) {
    if (!FETCHERS[name]) {
      console.error(`Unknown fetcher: "${name}". Use --list to see available fetchers.`);
      process.exit(1);
    }
  }

  log(`Running ${selectedNames.length} fetcher(s): ${selectedNames.join(", ")}`);
  if (dryRun) log("(dry run — will not write pricing.ts)");

  const allResults: FetchResult[] = [];
  const errors: Array<{ name: string; error: Error }> = [];

  // Run fetchers sequentially (cloud provider fetchers are already parallelized internally)
  for (const name of selectedNames) {
    const fetcher = FETCHERS[name];
    log(`\n── ${fetcher.name} (${fetcher.technologies.length} technologies) ──`);
    try {
      const results = await fetcher.fetch();
      allResults.push(...results);
      log(`  ${fetcher.name}: ${results.length} results`);
    } catch (err) {
      const error = err as Error;
      errors.push({ name, error });
      warn(`${fetcher.name} FAILED: ${error.message}`);
    }
  }

  // Summary
  log("\n── Summary ──");
  log(`Total results: ${allResults.length}`);
  if (errors.length > 0) {
    warn(`Failed fetchers: ${errors.map((e) => e.name).join(", ")}`);
  }

  // Write cache
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = resolve(CACHE_DIR, "results.json");
  await writeFile(cachePath, JSON.stringify(allResults, null, 2), "utf-8");
  log(`Cached results to ${cachePath}`);

  // Generate pricing.ts
  if (dryRun) {
    log("Dry run complete — pricing.ts NOT updated.");
    const techSet = new Set(allResults.map((r) => r.technology));
    log(`Would write ${techSet.size} technologies.`);
  } else {
    await generatePricingFile(allResults);
  }

  if (errors.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
