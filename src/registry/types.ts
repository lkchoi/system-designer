import type { PlanFieldDef, TechnologyInfo } from "../types";

export type ComponentTypeId = string;

export type ComponentCategory =
  | "compute"
  | "data"
  | "networking"
  | "messaging"
  | "scheduling"
  | "storage"
  | "client"
  | "custom";

/**
 * A structured plan field is one that doesn't fit the free-form string
 * model — e.g. a table of SQL columns, a list of DynamoDB access
 * patterns, a key→value mapping for search indexes. The canvas editor
 * renders a dedicated widget per `type`; the value persists as a YAML
 * string under `plan[key]` for backward compatibility.
 *
 * Widget mapping (see `src/components/PlanFieldWidget.tsx`):
 *   - columns-table         → SQL/warehouse column editor
 *   - access-patterns-list  → DynamoDB access pattern list
 *   - mappings-object       → ES/OpenSearch field mappings
 *   - operations-list       → stream-processor operator chain
 */
export interface StructuredFieldDef {
  key: string;
  label: string;
  type: "columns-table" | "access-patterns-list" | "mappings-object" | "operations-list";
  /** Optional helper text shown above the widget. */
  description?: string;
}

/**
 * Declares how a component type produces its build artifacts.
 *
 * `generators` is an ordered list of generator ids — the first one whose
 * `supports(ctx)` returns true is invoked. The id strings are the keys
 * of the generator registry in `src/converters/buildout/dispatch.ts`.
 *
 * Splitting the declaration (here) from the implementation (the
 * generator module) keeps the registry package free of buildout impl
 * imports — preventing a cycle and letting the registry remain the
 * single source of truth per CLAUDE.md.
 */
export interface BuildOutSpec {
  kind: "llm" | "deterministic" | "hybrid";
  generators: string[];
  structuredFields?: StructuredFieldDef[];
}

export interface ComponentRegistryEntry {
  id: ComponentTypeId;
  label: string;
  color: string;
  icon: string;
  category: ComponentCategory;
  planFields: PlanFieldDef[];
  technologies: TechnologyInfo[];
  connectsTo: ComponentTypeId[];
  source: "builtin" | "custom";
  /**
   * Build-out generator declaration. Omit on component types that don't
   * produce build artifacts (e.g. `client` for v1).
   */
  buildOut?: BuildOutSpec;
}
