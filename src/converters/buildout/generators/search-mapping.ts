/**
 * Deterministic search-engine index mapping generator.
 *
 * Default output is Elasticsearch / OpenSearch JSON mapping shape, which
 * is the de-facto baseline most search engines either accept directly
 * (OpenSearch, Quickwit) or translate from (Meilisearch, Typesense).
 *
 * plan.mappings YAML shape:
 *   fields:
 *     title: { type: text, analyzer: standard }
 *     created_at: { type: date }
 *     tags: { type: keyword }
 *   settings:
 *     number_of_shards: 3
 */

import yaml from "js-yaml";
import type { Generator, GeneratedFile } from "../types";

export const searchMappingGenerator: Generator = {
  kind: "deterministic",
  supports: (ctx) => ctx.node.componentType === "search-engine",
  async generate(ctx): Promise<GeneratedFile[]> {
    const p = ctx.node.plan ?? {};
    const indexName = p.indexName || "items";
    const replicas = parseInt(p.replicas || "1", 10) || 1;
    const analyzer = p.analyzer || "standard";

    const parsed = parseMappings(p.mappings);
    const fields = parsed?.fields ?? {};

    const mapping = {
      settings: {
        number_of_shards: parsed?.settings?.number_of_shards ?? 3,
        number_of_replicas: parsed?.settings?.number_of_replicas ?? replicas,
        analysis: { analyzer: { default: { type: analyzer } } },
      },
      mappings: {
        properties:
          Object.keys(fields).length > 0
            ? fields
            : {
                // Stubs so the index is valid even with no declared fields.
                id: { type: "keyword" },
                created_at: { type: "date" },
              },
        ...(Object.keys(fields).length === 0
          ? {
              _meta: { note: "stub — populate plan.mappings.fields with a YAML map" },
            }
          : {}),
      },
    };

    return [
      { path: `${indexName}.mapping.json`, contents: JSON.stringify(mapping, null, 2) + "\n" },
    ];
  },
};

interface ParsedMappings {
  fields?: Record<string, unknown>;
  settings?: { number_of_shards?: number; number_of_replicas?: number };
}

function parseMappings(s: string | undefined): ParsedMappings | undefined {
  if (!s) return undefined;
  try {
    return (yaml.load(s) as ParsedMappings) ?? undefined;
  } catch (err) {
    console.warn(`Failed to parse plan.mappings YAML: ${(err as Error).message}`);
    return undefined;
  }
}
