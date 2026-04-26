import type { ComponentType } from "../../../types";
import type { LangSnippet, MergedSlots, ScaffoldLang } from "./types";
import { EMPTY_SLOTS } from "./types";
import { mergeConcerns } from "./merge";
import { getClientConcern } from "./clients/index";

/** Info about a downstream connection passed from the compose exporter. */
export interface ConnectionInfo {
  /** Docker-compose service name of the target. */
  targetName: string;
  /** Component type of the target node. */
  targetComponentType: ComponentType;
  /** Resolved technology ID of the target (e.g., "redis", "postgresql"). */
  targetTechId: string;
  /** Edge label from the design (optional). */
  edgeLabel?: string;
}

/**
 * Resolve all client concerns for a set of outgoing connections and a
 * given scaffold language. Returns merged slots ready for the language
 * template to render.
 */
export function resolveConcerns(lang: ScaffoldLang, connections: ConnectionInfo[]): MergedSlots {
  const snippets: LangSnippet[] = [];
  const seen = new Set<string>();

  for (const conn of connections) {
    // Deduplicate by targetTechId (e.g., two Redis connections → one concern).
    if (seen.has(conn.targetTechId)) continue;
    seen.add(conn.targetTechId);

    const concern = getClientConcern(conn.targetTechId);
    if (!concern) continue;

    const snippet = concern.snippet[lang];
    if (!snippet) continue;

    snippets.push(snippet);
  }

  if (snippets.length === 0) return EMPTY_SLOTS;
  return mergeConcerns(snippets);
}
