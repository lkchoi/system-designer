/**
 * Bulk sync operations — used for initial Y.Doc populate and full
 * materialization on first connect. The incremental functions in
 * sync.ts are used for per-mutation sync.
 */

import * as Y from "yjs";
import type { Node, Edge } from "@xyflow/react";
import { nodeToRecord, recordToNode, edgeToRecord, recordToEdge } from "./schema";
import { LOCAL_ORIGIN, yMapToRecord } from "./sync";

function valuesEqual(a: unknown, b: unknown): boolean {
  return a === b;
}

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
    for (const id of prevIds) {
      if (!nextById.has(id)) ymap.delete(id);
    }

    for (const node of nextNodes) {
      const rec = nodeToRecord(node);
      let entry = ymap.get(node.id);

      if (!entry) {
        entry = new Y.Map<unknown>();
        for (const [k, v] of Object.entries(rec)) {
          entry.set(k, v);
        }
        ymap.set(node.id, entry);
      } else if (prevIds.has(node.id)) {
        for (const [k, v] of Object.entries(rec)) {
          if (!valuesEqual(entry.get(k), v)) {
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
          if (!valuesEqual(entry.get(k), v)) {
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
    const node = recordToNode(yMapToRecord(entry)) as N;
    const local = localState.get(node.id);
    if (local) {
      if (local.selected != null) node.selected = local.selected;
      if (local.dragging != null) node.dragging = local.dragging;
    }
    nodes.push(node);
  });
  return nodes;
}

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
    const edge = recordToEdge(yMapToRecord(entry));
    const local = localState.get(edge.id);
    if (local?.selected != null) edge.selected = local.selected;
    edges.push(edge);
  });
  return edges;
}
