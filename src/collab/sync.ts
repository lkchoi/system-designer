/**
 * Y.Doc ↔ React state synchronization.
 *
 * Two sync directions:
 *   Outbound (React → Yjs): incremental diff using reference identity
 *   Inbound (Yjs → React): incremental patch using YEvent change info
 */

import * as Y from "yjs";
import type { Node, Edge } from "@xyflow/react";
import { nodeToRecord, recordToNode, edgeToRecord, recordToEdge } from "./schema";

/**
 * A unique origin used for local transactions so the UndoManager
 * only tracks changes made by this client.
 */
export const LOCAL_ORIGIN = "local";

// ─── Helpers ───────────────────────────────────────────────────────────

/** Read a Y.Map entry into a flat record. */
export function yMapToRecord(entry: Y.Map<unknown>): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  entry.forEach((v, k) => {
    rec[k] = v;
  });
  return rec;
}

/** Shallow equality check for Y.Map values (primitives + JSON strings). */
function valuesEqual(a: unknown, b: unknown): boolean {
  return a === b;
}

// ─── Outbound: React → Yjs (incremental) ──────────────────────────────

/**
 * Sync only the changed/added/removed nodes to the Y.Map.
 * Uses reference identity (prevNode !== nextNode) to avoid diffing
 * unchanged nodes. Only the changed nodes go through nodeToRecord.
 */
export function syncChangedNodes(
  changed: Node[],
  added: Node[],
  removedIds: string[],
  ymap: Y.Map<Y.Map<unknown>>,
): void {
  const doc = ymap.doc;
  if (!doc) return;
  if (changed.length === 0 && added.length === 0 && removedIds.length === 0) return;

  doc.transact(() => {
    for (const id of removedIds) {
      ymap.delete(id);
    }

    for (const node of added) {
      const rec = nodeToRecord(node);
      const entry = new Y.Map<unknown>();
      for (const [k, v] of Object.entries(rec)) {
        entry.set(k, v);
      }
      ymap.set(node.id, entry);
    }

    for (const node of changed) {
      const entry = ymap.get(node.id);
      if (!entry) continue;
      const rec = nodeToRecord(node);
      for (const [k, v] of Object.entries(rec)) {
        if (!valuesEqual(entry.get(k), v)) {
          entry.set(k, v);
        }
      }
    }
  }, LOCAL_ORIGIN);
}

/**
 * Sync only the changed/added/removed edges to the Y.Map.
 */
export function syncChangedEdges(
  changed: Edge[],
  added: Edge[],
  removedIds: string[],
  ymap: Y.Map<Y.Map<unknown>>,
): void {
  const doc = ymap.doc;
  if (!doc) return;
  if (changed.length === 0 && added.length === 0 && removedIds.length === 0) return;

  doc.transact(() => {
    for (const id of removedIds) {
      ymap.delete(id);
    }

    for (const edge of added) {
      const rec = edgeToRecord(edge);
      const entry = new Y.Map<unknown>();
      for (const [k, v] of Object.entries(rec)) {
        entry.set(k, v);
      }
      ymap.set(edge.id, entry);
    }

    for (const edge of changed) {
      const entry = ymap.get(edge.id);
      if (!entry) continue;
      const rec = edgeToRecord(edge);
      for (const [k, v] of Object.entries(rec)) {
        if (!valuesEqual(entry.get(k), v)) {
          entry.set(k, v);
        }
      }
    }
  }, LOCAL_ORIGIN);
}

/**
 * Diff two node arrays using reference identity and return the
 * changed, added, and removed sets. O(n) scan but O(changed) for
 * the expensive nodeToRecord work that happens downstream.
 */
export function diffNodes<N extends Node>(
  prev: N[],
  next: N[],
): { changed: N[]; added: N[]; removedIds: string[] } {
  const prevById = new Map<string, N>();
  for (const n of prev) prevById.set(n.id, n);

  const changed: N[] = [];
  const added: N[] = [];

  for (const n of next) {
    const p = prevById.get(n.id);
    if (!p) added.push(n);
    else if (p !== n) changed.push(n); // reference inequality = changed
  }

  const nextIds = new Set(next.map((n) => n.id));
  const removedIds: string[] = [];
  for (const id of prevById.keys()) {
    if (!nextIds.has(id)) removedIds.push(id);
  }

  return { changed, added, removedIds };
}

/**
 * Diff two edge arrays using reference identity.
 */
export function diffEdges(
  prev: Edge[],
  next: Edge[],
): { changed: Edge[]; added: Edge[]; removedIds: string[] } {
  const prevById = new Map<string, Edge>();
  for (const e of prev) prevById.set(e.id, e);

  const changed: Edge[] = [];
  const added: Edge[] = [];

  for (const e of next) {
    const p = prevById.get(e.id);
    if (!p) added.push(e);
    else if (p !== e) changed.push(e);
  }

  const nextIds = new Set(next.map((e) => e.id));
  const removedIds: string[] = [];
  for (const id of prevById.keys()) {
    if (!nextIds.has(id)) removedIds.push(id);
  }

  return { changed, added, removedIds };
}

// ─── Inbound: Yjs → React (incremental patch) ─────────────────────────

/**
 * Incrementally patch the nodes array based on Y.Doc change events.
 * Only reconstructs nodes that actually changed, preserving local
 * state (selected, dragging) on patched nodes.
 */
export function patchNodesFromEvents<N extends Node>(
  events: Y.YEvent<unknown>[],
  nodesMap: Y.Map<Y.Map<unknown>>,
  currentNodes: N[],
): N[] {
  let next = currentNodes;
  const patched = new Set<string>();

  for (const event of events) {
    const path = event.path;

    if (path.length === 0 && event.target === nodesMap) {
      // Top-level: nodes added or removed from the nodesMap
      const keys = (event as Y.YMapEvent<Y.Map<unknown>>).keysChanged;
      for (const key of keys) {
        if (patched.has(key)) continue;
        patched.add(key);

        const entry = nodesMap.get(key);
        if (entry) {
          // Added or updated at top level
          const node = recordToNode(yMapToRecord(entry)) as N;
          const existing = next.find((n) => n.id === key);
          if (existing) {
            node.selected = existing.selected;
            node.dragging = existing.dragging;
            next = next.map((n) => (n.id === key ? node : n));
          } else {
            next = [...next, node];
          }
        } else {
          // Deleted
          next = next.filter((n) => n.id !== key);
        }
      }
    } else if (path.length >= 1) {
      // Nested: a specific node's Y.Map had properties changed
      const nodeId = path[0] as string;
      if (patched.has(nodeId)) continue;
      patched.add(nodeId);

      const entry = nodesMap.get(nodeId);
      if (!entry) continue;

      const node = recordToNode(yMapToRecord(entry)) as N;
      const existing = next.find((n) => n.id === nodeId);
      if (existing) {
        node.selected = existing.selected;
        node.dragging = existing.dragging;
      }
      next = next.map((n) => (n.id === nodeId ? node : n));
    }
  }

  return next;
}

/**
 * Incrementally patch the edges array based on Y.Doc change events.
 */
export function patchEdgesFromEvents(
  events: Y.YEvent<unknown>[],
  edgesMap: Y.Map<Y.Map<unknown>>,
  currentEdges: Edge[],
): Edge[] {
  let next = currentEdges;
  const patched = new Set<string>();

  for (const event of events) {
    const path = event.path;

    if (path.length === 0 && event.target === edgesMap) {
      const keys = (event as Y.YMapEvent<Y.Map<unknown>>).keysChanged;
      for (const key of keys) {
        if (patched.has(key)) continue;
        patched.add(key);

        const entry = edgesMap.get(key);
        if (entry) {
          const edge = recordToEdge(yMapToRecord(entry));
          const existing = next.find((e) => e.id === key);
          if (existing) {
            edge.selected = existing.selected;
            next = next.map((e) => (e.id === key ? edge : e));
          } else {
            next = [...next, edge];
          }
        } else {
          next = next.filter((e) => e.id !== key);
        }
      }
    } else if (path.length >= 1) {
      const edgeId = path[0] as string;
      if (patched.has(edgeId)) continue;
      patched.add(edgeId);

      const entry = edgesMap.get(edgeId);
      if (!entry) continue;

      const edge = recordToEdge(yMapToRecord(entry));
      const existing = next.find((e) => e.id === edgeId);
      if (existing) edge.selected = existing.selected;
      next = next.map((e) => (e.id === edgeId ? edge : e));
    }
  }

  return next;
}

// ─── Bulk operations (kept for initial populate / full sync) ───────────

export {
  materializeNodes,
  materializeEdges,
  syncNodesToYMap,
  syncEdgesToYMap,
} from "./sync-bulk";
