/**
 * Y.Doc ↔ React state synchronization.
 *
 * Provides functions to:
 * 1. Diff two arrays and apply changes to a Y.Map (React → Yjs)
 * 2. Observe a Y.Map and produce a React state update (Yjs → React)
 */

import * as Y from "yjs";
import type { Node, Edge } from "@xyflow/react";
import { nodeToRecord, recordToNode, edgeToRecord, recordToEdge } from "./schema";

/**
 * A unique origin used for local transactions so the UndoManager
 * only tracks changes made by this client.
 */
export const LOCAL_ORIGIN = "local";

// ─── React → Yjs (diff and apply) ─────────────────────────────────────

/**
 * Compare prevNodes and nextNodes, then apply the minimal diff to the
 * Y.Map. Runs inside a single Y.Doc transaction for atomicity.
 *
 * Skips `selected`, `dragging`, and other per-user keys.
 */
export function syncNodesToYMap(
  prevNodes: Node[],
  nextNodes: Node[],
  ymap: Y.Map<Y.Map<unknown>>,
): void {
  const doc = ymap.doc;
  if (!doc) return;

  const nextById = new Map(nextNodes.map((n) => [n.id, n]));
  const prevIds = new Set(prevNodes.map((n) => n.id));

  doc.transact(() => {
    // Removals
    for (const id of prevIds) {
      if (!nextById.has(id)) ymap.delete(id);
    }

    // Additions + updates
    for (const node of nextNodes) {
      const rec = nodeToRecord(node);
      let entry = ymap.get(node.id);

      if (!entry) {
        // New node
        entry = new Y.Map<unknown>();
        for (const [k, v] of Object.entries(rec)) {
          entry.set(k, v);
        }
        ymap.set(node.id, entry);
      } else if (prevIds.has(node.id)) {
        // Existing node — only write changed keys
        for (const [k, v] of Object.entries(rec)) {
          const current = entry.get(k);
          if (!valuesEqual(current, v)) {
            entry.set(k, v);
          }
        }
        // Remove keys that no longer exist in the record
        // (rare, but handles cases like optional fields being unset)
        entry.forEach((_, k) => {
          if (!(k in rec)) entry!.delete(k);
        });
      }
    }
  }, LOCAL_ORIGIN);
}

/**
 * Compare prevEdges and nextEdges, then apply the minimal diff to the
 * Y.Map.
 */
export function syncEdgesToYMap(
  prevEdges: Edge[],
  nextEdges: Edge[],
  ymap: Y.Map<Y.Map<unknown>>,
): void {
  const doc = ymap.doc;
  if (!doc) return;

  const nextById = new Map(nextEdges.map((e) => [e.id, e]));
  const prevIds = new Set(prevEdges.map((e) => e.id));

  doc.transact(() => {
    for (const id of prevIds) {
      if (!nextById.has(id)) ymap.delete(id);
    }

    for (const edge of nextEdges) {
      const rec = edgeToRecord(edge);
      let entry = ymap.get(edge.id);

      if (!entry) {
        entry = new Y.Map<unknown>();
        for (const [k, v] of Object.entries(rec)) {
          entry.set(k, v);
        }
        ymap.set(edge.id, entry);
      } else if (prevIds.has(edge.id)) {
        for (const [k, v] of Object.entries(rec)) {
          const current = entry.get(k);
          if (!valuesEqual(current, v)) {
            entry.set(k, v);
          }
        }
        entry.forEach((_, k) => {
          if (!(k in rec)) entry!.delete(k);
        });
      }
    }
  }, LOCAL_ORIGIN);
}

// ─── Yjs → React (materialize) ────────────────────────────────────────

/**
 * Materialize all nodes from Y.Map, preserving local-only state
 * (selected, dragging) from the current React state.
 */
export function materializeNodes<N extends Node>(
  ymap: Y.Map<Y.Map<unknown>>,
  currentNodes: N[],
): N[] {
  const localState = new Map<string, Partial<N>>();
  for (const n of currentNodes) {
    localState.set(n.id, {
      selected: n.selected,
      dragging: n.dragging,
    } as Partial<N>);
  }

  const nodes: N[] = [];
  ymap.forEach((entry) => {
    const rec: Record<string, unknown> = {};
    entry.forEach((v, k) => {
      rec[k] = v;
    });
    const node = recordToNode(rec) as N;
    const local = localState.get(node.id);
    if (local) {
      if (local.selected != null) node.selected = local.selected;
      if (local.dragging != null) node.dragging = local.dragging;
    }
    nodes.push(node);
  });
  return nodes;
}

/**
 * Materialize all edges from Y.Map, preserving local-only state.
 */
export function materializeEdges(
  ymap: Y.Map<Y.Map<unknown>>,
  currentEdges: Edge[],
): Edge[] {
  const localState = new Map<string, Partial<Edge>>();
  for (const e of currentEdges) {
    localState.set(e.id, { selected: e.selected } as Partial<Edge>);
  }

  const edges: Edge[] = [];
  ymap.forEach((entry) => {
    const rec: Record<string, unknown> = {};
    entry.forEach((v, k) => {
      rec[k] = v;
    });
    const edge = recordToEdge(rec);
    const local = localState.get(edge.id);
    if (local?.selected != null) edge.selected = local.selected;
    edges.push(edge);
  });
  return edges;
}

// ─── Utilities ─────────────────────────────────────────────────────────

/** Shallow equality check for Y.Map values (primitives + JSON strings). */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  // Both are primitives or JSON strings at this point
  return false;
}
