/**
 * Buildout subsystem types.
 *
 * Sibling to `src/converters/scaffold/`. Takes design nodes + edges and
 * produces implementation artifacts (code, schemas, configs, tests).
 *
 * Two generator kinds:
 *  - "deterministic": pure-function generators (DDL, OpenAPI, k8s manifests)
 *  - "llm": prompt-driven generators (service handlers, stream operators)
 *  - "hybrid": deterministic skeleton with LLM-filled bodies
 *
 * Per CLAUDE.md, registry remains the single source of truth — generator
 * dispatch happens via componentType, not by hard-coding switch statements
 * in callers.
 */

import type { ComponentType, SystemNodeData, Endpoint } from "../../types";
import type { MergedSlots, ScaffoldLang } from "../scaffold/concerns/types";

/** Shape of an inbound or outbound edge as seen by a generator. */
export interface EdgeRef {
  /** Other node's id. */
  otherNodeId: string;
  /** Other node's label (human-readable). */
  otherNodeLabel: string;
  /** Other node's componentType (e.g. "database", "cache"). */
  otherComponentType: ComponentType;
  /** Resolved technology id on the other node (e.g. "postgresql", "redis"). */
  otherTechId: string;
  /** Edge label as drawn (e.g. "submits order"). */
  label?: string;
  /** Wire protocol on the edge. */
  protocol?: string;
  /** Wire format on the edge. */
  format?: string;
}

/** Single file produced by a generator. */
export interface GeneratedFile {
  /** Path relative to the per-node output folder. */
  path: string;
  /** File contents. */
  contents: string;
  /**
   * SHA-256 of the prompt that produced this file, used by manifest.ts to
   * detect when a regenerate is needed. Omit for deterministic generators.
   */
  promptHash?: string;
}

/** Input handed to a generator. */
export interface GeneratorContext {
  /** Node id, label, componentType, plan fields, endpoints, description, etc. */
  node: SystemNodeData & { id: string };
  /** Inbound edges (other → this). */
  inbound: EdgeRef[];
  /** Outbound edges (this → other). */
  outbound: EdgeRef[];
  /**
   * Pre-resolved scaffold output for service-like nodes. The buildout
   * pipeline runs `resolveConcerns()` once per node before invoking the
   * generator, so the LLM sees the same client setup the scaffolded code
   * will use.
   */
  mergedSlots?: MergedSlots;
  /** Target language for compute generators. */
  language?: ScaffoldLang;
  /** Endpoints attached to the node, if any. */
  endpoints?: Endpoint[];
}

/** Generator interface. */
export interface Generator {
  kind: "llm" | "deterministic" | "hybrid";
  /** True when this generator can handle the given context. */
  supports: (ctx: GeneratorContext) => boolean;
  /** Produce 0..n files for the node. */
  generate: (ctx: GeneratorContext) => Promise<GeneratedFile[]>;
}

/** Aggregated result of one buildout run. */
export interface BuildOutResult {
  files: GeneratedFile[];
  skipped: { nodeId: string; reason: string }[];
  errors: { nodeId: string; error: string }[];
}

/** Options surfaced via the public API and CLI. */
export interface BuildOutOpts {
  /** Default language for compute nodes (overridable per node via plan.technology). */
  defaultLanguage?: ScaffoldLang;
  /** Restrict to specific componentTypes. */
  onlyTypes?: ComponentType[];
  /** Restrict to specific node ids. */
  onlyNodeIds?: string[];
  /** Don't write to disk; populate result.files only. */
  dryRun?: boolean;
}
