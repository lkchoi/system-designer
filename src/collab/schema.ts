/**
 * Yjs ↔ ReactFlow conversion functions.
 *
 * Nodes and edges are stored in Y.Maps keyed by ID. Each entity is a flat
 * Y.Map where primitives are direct values and nested objects (metrics,
 * plan, endpoints, links) are JSON-stringified.
 *
 * Per-user state (`selected`) is stripped when writing to Y.Doc and
 * excluded when reading back.
 */

import * as Y from "yjs";
import type { Node, Edge } from "@xyflow/react";

// ─── Keys that are JSON-stringified in Y.Map ───────────────────────────

const JSON_KEYS = new Set([
  "data.metrics",
  "data.plan",
  "data.endpoints",
  "data.links",
  "data.env",
]);

/** Per-user state never written to Y.Doc. */
const EXCLUDED_KEYS = new Set(["selected", "dragging", "draggable", "selectable", "resizing"]);

// ─── Node conversion ───────────────────────────────────────────────────

/** Flatten a ReactFlow Node into a plain record suitable for Y.Map. */
export function nodeToRecord(node: Node): Record<string, unknown> {
  const rec: Record<string, unknown> = {
    id: node.id,
    type: node.type ?? "system",
    "position.x": node.position.x,
    "position.y": node.position.y,
  };

  if (node.parentId) rec.parentId = node.parentId;
  if (node.zIndex != null) rec.zIndex = node.zIndex;
  if (node.hidden != null) rec.hidden = node.hidden;
  if (node.measured?.width != null) rec["measured.width"] = node.measured.width;
  if (node.measured?.height != null) rec["measured.height"] = node.measured.height;

  // Style dimensions (used by containers and resizable nodes)
  const style = node.style as Record<string, unknown> | undefined;
  if (style?.width != null) rec["style.width"] = style.width;
  if (style?.height != null) rec["style.height"] = style.height;

  // Flatten data.* — JSON-stringify complex values
  if (node.data && typeof node.data === "object") {
    for (const [k, v] of Object.entries(node.data as Record<string, unknown>)) {
      const key = `data.${k}`;
      if (JSON_KEYS.has(key)) {
        rec[key] = JSON.stringify(v);
      } else {
        rec[key] = v;
      }
    }
  }

  return rec;
}

/** Reconstitute a ReactFlow Node from a flat record (from Y.Map). */
export function recordToNode(rec: Record<string, unknown>): Node {
  const node: Node = {
    id: rec.id as string,
    type: (rec.type as string) ?? "system",
    position: {
      x: rec["position.x"] as number,
      y: rec["position.y"] as number,
    },
    data: {},
  };

  if (rec.parentId) node.parentId = rec.parentId as string;
  if (rec.zIndex != null) node.zIndex = rec.zIndex as number;
  if (rec.hidden != null) node.hidden = rec.hidden as boolean;

  if (rec["measured.width"] != null || rec["measured.height"] != null) {
    node.measured = {
      width: rec["measured.width"] as number | undefined,
      height: rec["measured.height"] as number | undefined,
    };
  }

  if (rec["style.width"] != null || rec["style.height"] != null) {
    node.style = {
      ...(rec["style.width"] != null ? { width: rec["style.width"] } : {}),
      ...(rec["style.height"] != null ? { height: rec["style.height"] } : {}),
    };
  }

  // Reconstitute data.* — JSON-parse complex values
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!k.startsWith("data.")) continue;
    const dataKey = k.slice(5);
    if (JSON_KEYS.has(k) && typeof v === "string") {
      try {
        data[dataKey] = JSON.parse(v);
      } catch {
        data[dataKey] = v;
      }
    } else {
      data[dataKey] = v;
    }
  }
  node.data = data;

  return node;
}

// ─── Edge conversion ───────────────────────────────────────────────────

/** Flatten a ReactFlow Edge into a plain record suitable for Y.Map. */
export function edgeToRecord(edge: Edge): Record<string, unknown> {
  const rec: Record<string, unknown> = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type ?? "labeled",
  };

  if (edge.sourceHandle) rec.sourceHandle = edge.sourceHandle;
  if (edge.targetHandle) rec.targetHandle = edge.targetHandle;

  if (edge.data && typeof edge.data === "object") {
    for (const [k, v] of Object.entries(edge.data as Record<string, unknown>)) {
      rec[`data.${k}`] = v;
    }
  }

  return rec;
}

/** Reconstitute a ReactFlow Edge from a flat record (from Y.Map). */
export function recordToEdge(rec: Record<string, unknown>): Edge {
  const edge: Edge = {
    id: rec.id as string,
    source: rec.source as string,
    target: rec.target as string,
    type: (rec.type as string) ?? "labeled",
  };

  if (rec.sourceHandle) edge.sourceHandle = rec.sourceHandle as string;
  if (rec.targetHandle) edge.targetHandle = rec.targetHandle as string;

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!k.startsWith("data.")) continue;
    data[k.slice(5)] = v;
  }
  edge.data = data;

  return edge;
}

// ─── Bulk Y.Doc operations ─────────────────────────────────────────────

/** Populate a Y.Map from a ReactFlow Node array. Clears existing entries. */
export function nodesToYMap(nodes: Node[], ymap: Y.Map<Y.Map<unknown>>): void {
  const doc = ymap.doc!;
  doc.transact(() => {
    // Remove entries not in the new set
    for (const key of ymap.keys()) {
      if (!nodes.some((n) => n.id === key)) ymap.delete(key);
    }
    // Add/update entries
    for (const node of nodes) {
      const rec = nodeToRecord(node);
      let entry = ymap.get(node.id);
      if (!entry) {
        entry = new Y.Map<unknown>();
        ymap.set(node.id, entry);
      }
      for (const [k, v] of Object.entries(rec)) {
        if (!EXCLUDED_KEYS.has(k)) entry.set(k, v);
      }
    }
  });
}

/** Materialize all nodes from a Y.Map. */
export function yMapToNodes(ymap: Y.Map<Y.Map<unknown>>): Node[] {
  const nodes: Node[] = [];
  ymap.forEach((entry) => {
    const rec: Record<string, unknown> = {};
    entry.forEach((v, k) => {
      rec[k] = v;
    });
    nodes.push(recordToNode(rec));
  });
  return nodes;
}

/** Populate a Y.Map from a ReactFlow Edge array. Clears existing entries. */
export function edgesToYMap(edges: Edge[], ymap: Y.Map<Y.Map<unknown>>): void {
  const doc = ymap.doc!;
  doc.transact(() => {
    for (const key of ymap.keys()) {
      if (!edges.some((e) => e.id === key)) ymap.delete(key);
    }
    for (const edge of edges) {
      const rec = edgeToRecord(edge);
      let entry = ymap.get(edge.id);
      if (!entry) {
        entry = new Y.Map<unknown>();
        ymap.set(edge.id, entry);
      }
      for (const [k, v] of Object.entries(rec)) {
        if (!EXCLUDED_KEYS.has(k)) entry.set(k, v);
      }
    }
  });
}

/** Materialize all edges from a Y.Map. */
export function yMapToEdges(ymap: Y.Map<Y.Map<unknown>>): Edge[] {
  const edges: Edge[] = [];
  ymap.forEach((entry) => {
    const rec: Record<string, unknown> = {};
    entry.forEach((v, k) => {
      rec[k] = v;
    });
    edges.push(recordToEdge(rec));
  });
  return edges;
}
