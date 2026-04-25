import type { LangSnippet, MergedSlots } from "./types";

/**
 * Merge multiple LangSnippets into a single MergedSlots.
 * Deps are merged (later wins on version conflict). Arrays are concatenated
 * in order, with duplicates removed for imports.
 */
export function mergeConcerns(snippets: LangSnippet[]): MergedSlots {
  const deps: Record<string, string> = {};
  const imports: string[] = [];
  const globals: string[] = [];
  const init: string[] = [];
  const shutdown: string[] = [];
  const healthChecks: string[] = [];

  const seenImports = new Set<string>();

  for (const s of snippets) {
    Object.assign(deps, s.deps);
    for (const imp of s.imports) {
      if (!seenImports.has(imp)) {
        seenImports.add(imp);
        imports.push(imp);
      }
    }
    globals.push(...s.globals);
    init.push(...s.init);
    shutdown.push(...s.shutdown);
    healthChecks.push(...s.healthChecks);
  }

  return { deps, imports, globals, init, shutdown, healthChecks };
}
