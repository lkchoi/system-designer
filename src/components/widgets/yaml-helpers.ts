/**
 * Shared YAML parse/serialize helpers for the structured-field widgets.
 *
 * Decisions:
 * - We use js-yaml (already a dep). `dump` is configured with sane
 *   defaults so the output round-trips cleanly to what generators read.
 * - Parse failures return `undefined` rather than throwing. Widgets fall
 *   back to a raw textarea when this happens so users can recover.
 */

import yaml from "js-yaml";

export function parseYaml<T>(s: string | undefined): T | undefined {
  if (!s || !s.trim()) return undefined;
  try {
    const v = yaml.load(s);
    return (v ?? undefined) as T | undefined;
  } catch {
    return undefined;
  }
}

export function dumpYaml(value: unknown): string {
  // lineWidth -1 prevents long-line wrapping that confuses round-trip diffs.
  return yaml.dump(value, { lineWidth: -1, noRefs: true });
}
