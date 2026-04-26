/**
 * Performance-focused tests for incremental sync.
 * Verifies that changing one node doesn't trigger O(n) work.
 */

import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import type { Node, Edge } from "@xyflow/react";
import {
  diffNodes,
  diffEdges,
  syncChangedNodes,
  patchNodesFromEvents,
  yMapToRecord,
} from "./sync";
import { nodesToYMap } from "./schema";
import { recordToNode } from "./schema";

function makeNode(id: string, x = 0, y = 0): Node {
  return {
    id,
    type: "system",
    position: { x, y },
    data: { label: id, componentType: "service" },
  };
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: "labeled", data: { label: "" } };
}

function makeNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, i) => makeNode(`n${i}`, i * 10, i * 10));
}

// ─── diffNodes ──────────────────────────────────────────────────────────

describe("diffNodes — reference identity", () => {
  it("detects zero changes when arrays have same references", () => {
    const nodes = makeNodes(500);
    const { changed, added, removedIds } = diffNodes(nodes, nodes);
    expect(changed).toHaveLength(0);
    expect(added).toHaveLength(0);
    expect(removedIds).toHaveLength(0);
  });

  it("detects exactly 1 changed node when only 1 reference differs", () => {
    const nodes = makeNodes(500);
    const next = nodes.map((n, i) =>
      i === 42 ? { ...n, position: { x: 999, y: 999 } } : n,
    );
    const { changed, added, removedIds } = diffNodes(nodes, next);
    expect(changed).toHaveLength(1);
    expect(changed[0].id).toBe("n42");
    expect(added).toHaveLength(0);
    expect(removedIds).toHaveLength(0);
  });

  it("detects addition", () => {
    const nodes = makeNodes(100);
    const newNode = makeNode("new-node", 500, 500);
    const { changed, added, removedIds } = diffNodes(nodes, [...nodes, newNode]);
    expect(changed).toHaveLength(0);
    expect(added).toHaveLength(1);
    expect(added[0].id).toBe("new-node");
    expect(removedIds).toHaveLength(0);
  });

  it("detects removal", () => {
    const nodes = makeNodes(100);
    const { changed, added, removedIds } = diffNodes(nodes, nodes.slice(1));
    expect(changed).toHaveLength(0);
    expect(added).toHaveLength(0);
    expect(removedIds).toHaveLength(1);
    expect(removedIds[0]).toBe("n0");
  });
});

// ─── syncChangedNodes ───────────────────────────────────────────────────

describe("syncChangedNodes — targeted Y.Doc writes", () => {
  it("only writes the changed node to Y.Map", () => {
    const doc = new Y.Doc();
    const ymap = doc.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    const nodes = makeNodes(100);
    nodesToYMap(nodes, ymap);

    // Change one node
    const changed = [{ ...nodes[5], position: { x: 777, y: 888 } }];
    syncChangedNodes(changed, [], [], ymap);

    const entry = ymap.get("n5")!;
    expect(entry.get("position.x")).toBe(777);
    expect(entry.get("position.y")).toBe(888);

    // Other nodes untouched
    const entry0 = ymap.get("n0")!;
    expect(entry0.get("position.x")).toBe(0);
  });

  it("adds a new node without touching existing entries", () => {
    const doc = new Y.Doc();
    const ymap = doc.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    const nodes = makeNodes(50);
    nodesToYMap(nodes, ymap);

    const newNode = makeNode("added", 999, 999);
    syncChangedNodes([], [newNode], [], ymap);

    expect(ymap.size).toBe(51);
    expect(ymap.get("added")!.get("position.x")).toBe(999);
  });

  it("removes a node without touching other entries", () => {
    const doc = new Y.Doc();
    const ymap = doc.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    const nodes = makeNodes(50);
    nodesToYMap(nodes, ymap);

    syncChangedNodes([], [], ["n10"], ymap);

    expect(ymap.size).toBe(49);
    expect(ymap.has("n10")).toBe(false);
    expect(ymap.has("n0")).toBe(true);
  });
});

// ─── patchNodesFromEvents ───────────────────────────────────────────────

describe("patchNodesFromEvents — incremental materialization", () => {
  it("patches only the changed node on a property update", () => {
    const doc = new Y.Doc();
    const ymap = doc.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    const nodes = makeNodes(100);
    nodesToYMap(nodes, ymap);

    // Capture events from a targeted change
    let capturedEvents: Y.YEvent<unknown>[] = [];
    ymap.observeDeep((events) => {
      capturedEvents = events;
    });

    // Change one node's position
    const entry = ymap.get("n7")!;
    doc.transact(() => {
      entry.set("position.x", 555);
      entry.set("position.y", 666);
    });

    expect(capturedEvents.length).toBeGreaterThan(0);

    // Patch from events
    const patched = patchNodesFromEvents(capturedEvents, ymap, nodes);

    // Only n7 should differ
    expect(patched.length).toBe(100);
    const n7 = patched.find((n) => n.id === "n7")!;
    expect(n7.position).toEqual({ x: 555, y: 666 });

    // Other nodes should be the exact same reference (identity preserved)
    const n0patched = patched.find((n) => n.id === "n0")!;
    const n0original = nodes.find((n) => n.id === "n0")!;
    expect(n0patched).toBe(n0original);
  });

  it("handles node addition from events", () => {
    const doc = new Y.Doc();
    const ymap = doc.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    const nodes = makeNodes(10);
    nodesToYMap(nodes, ymap);

    let capturedEvents: Y.YEvent<unknown>[] = [];
    ymap.observeDeep((events) => {
      capturedEvents = events;
    });

    // Add a new node
    doc.transact(() => {
      const entry = new Y.Map<unknown>();
      entry.set("id", "new");
      entry.set("type", "system");
      entry.set("position.x", 100);
      entry.set("position.y", 200);
      entry.set("data.label", "New Node");
      ymap.set("new", entry);
    });

    const patched = patchNodesFromEvents(capturedEvents, ymap, nodes);
    expect(patched.length).toBe(11);
    expect(patched.find((n) => n.id === "new")!.data.label).toBe("New Node");
  });

  it("handles node deletion from events", () => {
    const doc = new Y.Doc();
    const ymap = doc.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    const nodes = makeNodes(10);
    nodesToYMap(nodes, ymap);

    let capturedEvents: Y.YEvent<unknown>[] = [];
    ymap.observeDeep((events) => {
      capturedEvents = events;
    });

    doc.transact(() => {
      ymap.delete("n3");
    });

    const patched = patchNodesFromEvents(capturedEvents, ymap, nodes);
    expect(patched.length).toBe(9);
    expect(patched.find((n) => n.id === "n3")).toBeUndefined();
  });

  it("preserves local selected state on patched nodes", () => {
    const doc = new Y.Doc();
    const ymap = doc.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    const nodes = makeNodes(10).map((n, i) =>
      i === 3 ? { ...n, selected: true } : n,
    );
    nodesToYMap(nodes, ymap);

    let capturedEvents: Y.YEvent<unknown>[] = [];
    ymap.observeDeep((events) => {
      capturedEvents = events;
    });

    // Remote user changes n3's label
    doc.transact(() => {
      ymap.get("n3")!.set("data.label", "renamed");
    });

    const patched = patchNodesFromEvents(capturedEvents, ymap, nodes);
    const n3 = patched.find((n) => n.id === "n3")!;
    expect(n3.data.label).toBe("renamed");
    expect(n3.selected).toBe(true); // preserved
  });
});

// ─── diffEdges ──────────────────────────────────────────────────────────

describe("diffEdges — reference identity", () => {
  it("detects exactly 1 changed edge", () => {
    const edges = Array.from({ length: 100 }, (_, i) =>
      makeEdge(`e${i}`, `n${i}`, `n${i + 1}`),
    );
    const next = edges.map((e, i) =>
      i === 50 ? { ...e, data: { ...e.data, label: "updated" } } : e,
    );
    const { changed, added, removedIds } = diffEdges(edges, next);
    expect(changed).toHaveLength(1);
    expect(changed[0].id).toBe("e50");
    expect(added).toHaveLength(0);
    expect(removedIds).toHaveLength(0);
  });
});
