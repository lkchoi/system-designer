/**
 * Integration tests for the Y.Doc sync layer.
 *
 * Simulates two clients connected via in-memory Y.Doc update exchange.
 * Tests cover: sync, concurrent edits, add/remove, undo isolation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import type { Node, Edge } from "@xyflow/react";
import {
  syncNodesToYMap,
  syncEdgesToYMap,
  materializeNodes,
  materializeEdges,
  LOCAL_ORIGIN,
} from "./sync";
import { nodesToYMap, edgesToYMap, yMapToNodes, yMapToEdges } from "./schema";

// ─── Helpers ───────────────────────────────────────────────────────────

function makeNode(id: string, label: string, x = 100, y = 100): Node {
  return {
    id,
    type: "system",
    position: { x, y },
    data: {
      label,
      description: "",
      componentType: "service",
      status: "healthy",
      metrics: { cpu: 0, memory: 0, requestsPerSec: 0, latency: 0 },
      plan: {},
      sharded: false,
      shardKey: "",
      endpoints: [],
      links: [],
      capClassification: "",
      stressFailure: "none",
      capacityPercent: 100,
      consumerRate: 1000,
    },
  };
}

function makeEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    type: "labeled",
    data: {
      label: "",
      protocol: "HTTP",
      format: "JSON",
      partitioned: false,
      simulatedLatency: 0,
    },
  };
}

/** Exchange all pending updates between two Y.Docs. */
function syncDocs(doc1: Y.Doc, doc2: Y.Doc): void {
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2)));
  Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1)));
}

// ─── Test suite ────────────────────────────────────────────────────────

describe("two-client sync via syncNodesToYMap", () => {
  let doc1: Y.Doc;
  let doc2: Y.Doc;
  let nodesMap1: Y.Map<Y.Map<unknown>>;
  let nodesMap2: Y.Map<Y.Map<unknown>>;
  let edgesMap1: Y.Map<Y.Map<unknown>>;
  let edgesMap2: Y.Map<Y.Map<unknown>>;

  beforeEach(() => {
    doc1 = new Y.Doc();
    doc2 = new Y.Doc();
    nodesMap1 = doc1.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    nodesMap2 = doc2.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    edgesMap1 = doc1.getMap("edges") as Y.Map<Y.Map<unknown>>;
    edgesMap2 = doc2.getMap("edges") as Y.Map<Y.Map<unknown>>;
  });

  it("adding a node on client 1 appears on client 2 after sync", () => {
    const node = makeNode("n1", "API");
    syncNodesToYMap([], [node], nodesMap1);
    syncDocs(doc1, doc2);

    const nodes2 = materializeNodes(nodesMap2, []);
    expect(nodes2).toHaveLength(1);
    expect(nodes2[0].data.label).toBe("API");
  });

  it("removing a node on client 1 removes it on client 2", () => {
    const node = makeNode("n1", "API");
    syncNodesToYMap([], [node], nodesMap1);
    syncDocs(doc1, doc2);
    expect(materializeNodes(nodesMap2, [])).toHaveLength(1);

    syncNodesToYMap([node], [], nodesMap1);
    syncDocs(doc1, doc2);
    expect(materializeNodes(nodesMap2, [])).toHaveLength(0);
  });

  it("updating a node property on client 1 appears on client 2", () => {
    const node = makeNode("n1", "API");
    syncNodesToYMap([], [node], nodesMap1);
    syncDocs(doc1, doc2);

    const updated = { ...node, position: { x: 500, y: 600 } };
    syncNodesToYMap([node], [updated], nodesMap1);
    syncDocs(doc1, doc2);

    const nodes2 = materializeNodes(nodesMap2, []);
    expect(nodes2[0].position).toEqual({ x: 500, y: 600 });
  });

  it("concurrent edits to different nodes merge cleanly", () => {
    const n1 = makeNode("n1", "API");
    const n2 = makeNode("n2", "DB");
    syncNodesToYMap([], [n1, n2], nodesMap1);
    syncDocs(doc1, doc2);

    // Client 1 moves n1
    syncNodesToYMap([n1, n2], [{ ...n1, position: { x: 999, y: 999 } }, n2], nodesMap1);

    // Client 2 renames n2 (before receiving client 1's update)
    const n2on2 = materializeNodes(nodesMap2, [])[1];
    const n2updated = { ...n2on2, data: { ...n2on2.data, label: "Database" } };
    const n1on2 = materializeNodes(nodesMap2, [])[0];
    syncNodesToYMap([n1on2, n2on2], [n1on2, n2updated], nodesMap2);

    // Sync both directions
    syncDocs(doc1, doc2);

    const result1 = materializeNodes(nodesMap1, []);
    const result2 = materializeNodes(nodesMap2, []);

    // Both clients see both changes
    expect(result1.find((n) => n.id === "n1")!.position).toEqual({ x: 999, y: 999 });
    expect(result1.find((n) => n.id === "n2")!.data.label).toBe("Database");
    expect(result2.find((n) => n.id === "n1")!.position).toEqual({ x: 999, y: 999 });
    expect(result2.find((n) => n.id === "n2")!.data.label).toBe("Database");
  });

  it("concurrent edits to different properties of the same node merge", () => {
    const node = makeNode("n1", "API");
    syncNodesToYMap([], [node], nodesMap1);
    syncDocs(doc1, doc2);

    // Client 1 changes position
    syncNodesToYMap([node], [{ ...node, position: { x: 300, y: 400 } }], nodesMap1);

    // Client 2 changes label
    const nodeOn2 = materializeNodes(nodesMap2, [])[0];
    syncNodesToYMap(
      [nodeOn2],
      [{ ...nodeOn2, data: { ...nodeOn2.data, label: "Gateway" } }],
      nodesMap2,
    );

    syncDocs(doc1, doc2);

    const result = materializeNodes(nodesMap1, []);
    expect(result[0].position).toEqual({ x: 300, y: 400 });
    expect(result[0].data.label).toBe("Gateway");
  });

  it("preserves local selected state across remote sync", () => {
    const node = makeNode("n1", "API");
    syncNodesToYMap([], [node], nodesMap1);
    syncDocs(doc1, doc2);

    // Client 2 has node selected locally
    const localNodes = [{ ...materializeNodes(nodesMap2, [])[0], selected: true }];

    // Client 1 moves the node
    syncNodesToYMap([node], [{ ...node, position: { x: 500, y: 500 } }], nodesMap1);
    syncDocs(doc1, doc2);

    // Materialize on client 2 preserving local selected state
    const result = materializeNodes(nodesMap2, localNodes);
    expect(result[0].position).toEqual({ x: 500, y: 500 });
    expect(result[0].selected).toBe(true);
  });
});

describe("edge sync", () => {
  let doc1: Y.Doc;
  let doc2: Y.Doc;
  let edgesMap1: Y.Map<Y.Map<unknown>>;
  let edgesMap2: Y.Map<Y.Map<unknown>>;

  beforeEach(() => {
    doc1 = new Y.Doc();
    doc2 = new Y.Doc();
    edgesMap1 = doc1.getMap("edges") as Y.Map<Y.Map<unknown>>;
    edgesMap2 = doc2.getMap("edges") as Y.Map<Y.Map<unknown>>;
  });

  it("adding an edge on client 1 appears on client 2", () => {
    const edge = makeEdge("e1", "n1", "n2");
    syncEdgesToYMap([], [edge], edgesMap1);
    syncDocs(doc1, doc2);

    const result = materializeEdges(edgesMap2, []);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("n1");
    expect(result[0].target).toBe("n2");
    expect(result[0].data.protocol).toBe("HTTP");
  });

  it("updating edge data on client 1 syncs to client 2", () => {
    const edge = makeEdge("e1", "n1", "n2");
    syncEdgesToYMap([], [edge], edgesMap1);
    syncDocs(doc1, doc2);

    const updated = {
      ...edge,
      data: { ...edge.data, partitioned: true, label: "queries" },
    };
    syncEdgesToYMap([edge], [updated], edgesMap1);
    syncDocs(doc1, doc2);

    const result = materializeEdges(edgesMap2, []);
    expect(result[0].data.partitioned).toBe(true);
    expect(result[0].data.label).toBe("queries");
  });
});

describe("undo manager isolation", () => {
  it("undo on client 1 does not affect client 2 changes", () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    const nodesMap1 = doc1.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    const nodesMap2 = doc2.getMap("nodes") as Y.Map<Y.Map<unknown>>;

    const origin1 = "client-1";
    const origin2 = "client-2";

    const um1 = new Y.UndoManager([nodesMap1], {
      trackedOrigins: new Set([origin1]),
    });

    // Client 1 adds a node
    const node = makeNode("n1", "API");
    doc1.transact(() => {
      const entry = new Y.Map<unknown>();
      for (const [k, v] of Object.entries({ id: "n1", type: "system", "position.x": 100, "position.y": 100, "data.label": "API" })) {
        entry.set(k, v);
      }
      nodesMap1.set("n1", entry);
    }, origin1);

    syncDocs(doc1, doc2);

    // Client 2 adds another node
    doc2.transact(() => {
      const entry = new Y.Map<unknown>();
      for (const [k, v] of Object.entries({ id: "n2", type: "system", "position.x": 200, "position.y": 200, "data.label": "DB" })) {
        entry.set(k, v);
      }
      nodesMap2.set("n2", entry);
    }, origin2);

    syncDocs(doc1, doc2);

    // Both nodes exist on both docs
    expect(nodesMap1.size).toBe(2);
    expect(nodesMap2.size).toBe(2);

    // Client 1 undoes — should only remove n1, not n2
    um1.undo();
    syncDocs(doc1, doc2);

    expect(nodesMap1.size).toBe(1);
    expect(nodesMap1.has("n2")).toBe(true);
    expect(nodesMap1.has("n1")).toBe(false);

    expect(nodesMap2.size).toBe(1);
    expect(nodesMap2.has("n2")).toBe(true);

    um1.destroy();
  });
});
