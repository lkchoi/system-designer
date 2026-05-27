/**
 * Generator dispatch.
 *
 * Per CLAUDE.md, registry entries are the single source of truth for
 * component types. The buildOut field on a registry entry could declare
 * which generator to use, but we haven't extended ComponentRegistryEntry
 * yet (see buildout-plan.md — Registry changes). Until then, dispatch is
 * a flat map keyed by componentType.
 *
 * TODO(open-question): once we promote `buildOut` onto registry entries
 * (Tier 2 generators land first to motivate the structured plan fields),
 * collapse this map into a registry lookup.
 */

import type { ComponentType } from "../../types";
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

// Map componentType → ordered list of candidate generators. The first one
// whose `supports()` returns true wins.
const REGISTRY: Partial<Record<ComponentType, Generator[]>> = {
  service: [serviceLLMGenerator],
  serverless: [serverlessLLMGenerator],
  cron: [cronLLMGenerator],
  webhook: [webhookLLMGenerator],
  "stream-processor": [streamLLMGenerator],
  // dynamo first so it wins on technology=dynamodb; sql wins for postgres/mysql/etc.
  database: [dynamoSchemaGenerator, sqlSchemaGenerator],
  "api-gateway": [openApiGenerator],
  cache: [cacheConfigGenerator],
  "message-queue": [queueConfigGenerator],
  "search-engine": [searchMappingGenerator],
  storage: [storageConfigGenerator],
  "load-balancer": [lbConfigGenerator],
  firewall: [firewallConfigGenerator],
  dns: [dnsConfigGenerator],
  cdn: [cdnConfigGenerator],
  "container-orchestration": [k8sManifestGenerator],
  "data-warehouse": [warehouseSchemaGenerator],
  // message-queue, cache, storage, api-gateway, etc.
  // registered as deterministic Tier 2 generators land.
};

export function pickGenerator(ctx: GeneratorContext): Generator | undefined {
  const candidates = REGISTRY[ctx.node.componentType] ?? [];
  return candidates.find((g) => g.supports(ctx));
}

export function registerGenerator(type: ComponentType, generator: Generator): void {
  const list = REGISTRY[type] ?? [];
  list.push(generator);
  REGISTRY[type] = list;
}
