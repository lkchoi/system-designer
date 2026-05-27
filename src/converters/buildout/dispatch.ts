/**
 * Generator dispatch.
 *
 * The registry entry for each component type declares which generator(s)
 * to use via `buildOut.generators` (a list of string ids). This module
 * holds the id→impl map and resolves the right generator at runtime.
 *
 * Why two layers (registry declares, dispatch resolves):
 *  - Keeps the registry package free of buildout-impl imports.
 *  - Lets the registry stay the single source of truth (per CLAUDE.md):
 *    if a component type doesn't declare `buildOut`, it produces nothing.
 *  - Adding a new generator means: drop a file in `generators/`, register
 *    its id here, list the id in the relevant `builtin-entries.ts`.
 */

import { registry } from "../../registry";
import type { Generator, GeneratorContext } from "./types";
import { serviceLLMGenerator } from "./generators/service-llm";
import { serverlessLLMGenerator } from "./generators/serverless-llm";
import { cronLLMGenerator } from "./generators/cron-llm";
import { webhookLLMGenerator } from "./generators/webhook-llm";
import { streamLLMGenerator } from "./generators/stream-llm";
import { sqlSchemaGenerator } from "./generators/sql-schema";
import { dynamoSchemaGenerator } from "./generators/dynamo-schema";
import { openApiGenerator } from "./generators/openapi";
import { cacheConfigGenerator } from "./generators/cache-config";
import { queueConfigGenerator } from "./generators/queue-config";
import { searchMappingGenerator } from "./generators/search-mapping";
import { storageConfigGenerator } from "./generators/storage-config";
import { lbConfigGenerator } from "./generators/lb-config";
import { firewallConfigGenerator } from "./generators/firewall-config";
import { dnsConfigGenerator } from "./generators/dns-config";
import { cdnConfigGenerator } from "./generators/cdn-config";
import { k8sManifestGenerator } from "./generators/k8s-manifests";
import { warehouseSchemaGenerator } from "./generators/warehouse-schema";

/**
 * Generator id → implementation. Ids are referenced by string from
 * `ComponentRegistryEntry.buildOut.generators`. Keep ids stable — renames
 * here require updating every registry entry that uses them.
 */
const GENERATOR_REGISTRY: Record<string, Generator> = {
  "service-llm": serviceLLMGenerator,
  "serverless-llm": serverlessLLMGenerator,
  "cron-llm": cronLLMGenerator,
  "webhook-llm": webhookLLMGenerator,
  "stream-llm": streamLLMGenerator,
  "sql-schema": sqlSchemaGenerator,
  "dynamo-schema": dynamoSchemaGenerator,
  openapi: openApiGenerator,
  "cache-config": cacheConfigGenerator,
  "queue-config": queueConfigGenerator,
  "search-mapping": searchMappingGenerator,
  "storage-config": storageConfigGenerator,
  "lb-config": lbConfigGenerator,
  "firewall-config": firewallConfigGenerator,
  "dns-config": dnsConfigGenerator,
  "cdn-config": cdnConfigGenerator,
  "k8s-manifests": k8sManifestGenerator,
  "warehouse-schema": warehouseSchemaGenerator,
};

/**
 * Resolve the generator for a given context by consulting the registry
 * entry's `buildOut.generators` list and walking it in order. The first
 * whose `supports(ctx)` returns true wins.
 */
export function pickGenerator(ctx: GeneratorContext): Generator | undefined {
  const entry = registry.get(ctx.node.componentType);
  if (!entry?.buildOut) return undefined;
  for (const id of entry.buildOut.generators) {
    const gen = GENERATOR_REGISTRY[id];
    if (!gen) {
      // A registry entry references an unknown generator id — surface
      // loudly so dev notices, but don't crash the whole run.
      console.warn(
        `buildOut: registry entry "${ctx.node.componentType}" references unknown generator id "${id}"`,
      );
      continue;
    }
    if (gen.supports(ctx)) return gen;
  }
  return undefined;
}

/**
 * Late-registration hook. Used in tests and for plugins. Production code
 * paths should declare generators in the registry, not call this.
 */
export function registerGenerator(id: string, generator: Generator): void {
  GENERATOR_REGISTRY[id] = generator;
}
