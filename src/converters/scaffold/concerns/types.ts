/**
 * Scaffold concern types.
 *
 * A scaffolded service is: Runtime + Client[] + Language Template.
 * Each concern contributes a LangSnippet per language; the merge
 * function combines them into MergedSlots that the language template
 * renders into final source files.
 */

export type ScaffoldLang = "go" | "node" | "python";

/**
 * What a single concern contributes to a specific language's scaffold.
 * All fields are arrays/records that merge additively.
 */
export interface LangSnippet {
  /** Package deps. Go: module → version. Node: package → version. Python: package==version. */
  deps: Record<string, string>;
  /** Import lines in language-native syntax. */
  imports: string[];
  /** Top-level declarations (var, const, type). */
  globals: string[];
  /** Startup code — runs once, in order, before the server/handler starts. */
  init: string[];
  /** Graceful shutdown code — runs on SIGTERM / context cancellation. */
  shutdown: string[];
  /** Health-check expressions. Go: returns error. Node: returns Promise. Python: returns bool. */
  healthChecks: string[];
}

/** A client concern connects to a specific downstream technology. */
export interface ClientConcern {
  /** Target technology ID matching TECH_RULES (e.g., "redis", "postgresql"). */
  targetTechId: string;
  /** Env vars this concern reads (for documentation / validation). */
  envVars: string[];
  /** Per-language code snippets. */
  snippet: Partial<Record<ScaffoldLang, LangSnippet>>;
}

/** A runtime concern controls the entrypoint shape. */
export interface RuntimeConcern {
  /** Runtime identifier. */
  id: string;
  /** Which languages this runtime supports. */
  appliesTo: ScaffoldLang[];
  /** Per-language code snippets (deps, imports for the runtime itself). */
  snippet: Partial<Record<ScaffoldLang, LangSnippet>>;
}

/** Result of merging all concerns for one language. */
export interface MergedSlots {
  deps: Record<string, string>;
  imports: string[];
  globals: string[];
  init: string[];
  shutdown: string[];
  healthChecks: string[];
}

/** An empty MergedSlots value — no concerns applied. */
export const EMPTY_SLOTS: MergedSlots = {
  deps: {},
  imports: [],
  globals: [],
  init: [],
  shutdown: [],
  healthChecks: [],
};
