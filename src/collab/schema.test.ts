import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import {
  nodeToRecord,
  recordToNode,
  edgeToRecord,
  recordToEdge,
  nodesToYMap,
  yMapToNodes,
  edgesToYMap,
  yMapToEdges,
} from "./schema";
import type { Node, Edge } from "@xyflow/react";

const sampleSystemNode: Node = {
  id: "node-1",
  type: "system",
  position: { x: 100, y: 200 },
  data: {
    label: "API Gateway",
    description: "Routes traffic",
    componentType: "api-gateway",
    status: "healthy",
    metrics: { cpu: 45, memory: 60, requestsPerSec: 1200, latency: 12 },
    plan: { technology: "Kong" },
    sharded: false,
    shardKey: "",
    endpoints: [{ id: "ep1", method: "GET", path: "/health" }],
    links: [{ id: "lk1", label: "Docs", url: "https://example.com" }],
    capClassification: "",
    stressFailure: "none",
    capacityPercent: 100,
    consumerRate: 1000,
  },
};

const sampleContainerNode: Node = {
  id: "container-1",
  type: "container",
  position: { x: 50, y: 50 },
  zIndex: -1,
  style: { width: 400, height: 300 },
  data: {
    label: "VPC",
    color: "rgba(99,102,241,0.04)",
    collapsed: false,
  },
};

const sampleEdge: Edge = {
  id: "edge-1",
  source: "node-1",
  target: "node-2",
  type: "labeled",
  data: {
    label: "queries",
    protocol: "HTTP",
    format: "JSON",
    partitioned: false,
    simulatedLatency: 0,
  },
};

// ─── nodeToRecord / recordToNode ────────────────────────────────────────

describe("nodeToRecord / recordToNode", () => {
  it("round-trips a system node", () => {
    const rec = nodeToRecord(sampleSystemNode);
    const restored = recordToNode(rec);
    expect(restored.id).toBe("node-1");
    expect(restored.type).toBe("system");
    expect(restored.position).toEqual({ x: 100, y: 200 });
    expect(restored.data.label).toBe("API Gateway");
    expect(restored.data.componentType).toBe("api-gateway");
    expect(restored.data.sharded).toBe(false);
    expect(restored.data.capacityPercent).toBe(100);
  });

  it("JSON-stringifies complex data fields", () => {
    const rec = nodeToRecord(sampleSystemNode);
    expect(typeof rec["data.metrics"]).toBe("string");
    expect(typeof rec["data.plan"]).toBe("string");
    expect(typeof rec["data.endpoints"]).toBe("string");
    expect(typeof rec["data.links"]).toBe("string");
  });

  it("restores JSON-parsed complex data fields", () => {
    const rec = nodeToRecord(sampleSystemNode);
    const restored = recordToNode(rec);
    expect(restored.data.metrics).toEqual({
      cpu: 45,
      memory: 60,
      requestsPerSec: 1200,
      latency: 12,
    });
    expect(restored.data.endpoints).toEqual([{ id: "ep1", method: "GET", path: "/health" }]);
  });

  it("round-trips a container node with style", () => {
    const rec = nodeToRecord(sampleContainerNode);
    const restored = recordToNode(rec);
    expect(restored.id).toBe("container-1");
    expect(restored.type).toBe("container");
    expect(restored.zIndex).toBe(-1);
    expect(restored.style).toEqual({ width: 400, height: 300 });
    expect(restored.data.label).toBe("VPC");
    expect(restored.data.collapsed).toBe(false);
  });

  it("handles node with parentId", () => {
    const child: Node = { ...sampleSystemNode, id: "child-1", parentId: "container-1" };
    const rec = nodeToRecord(child);
    const restored = recordToNode(rec);
    expect(restored.parentId).toBe("container-1");
  });

  it("handles node with hidden=true", () => {
    const hidden: Node = { ...sampleSystemNode, id: "hidden-1", hidden: true };
    const rec = nodeToRecord(hidden);
    const restored = recordToNode(rec);
    expect(restored.hidden).toBe(true);
  });

  it("excludes 'selected' from record", () => {
    const selected: Node = { ...sampleSystemNode, selected: true };
    const rec = nodeToRecord(selected);
    expect(rec).not.toHaveProperty("selected");
  });
});

// ─── edgeToRecord / recordToEdge ────────────────────────────────────────

describe("edgeToRecord / recordToEdge", () => {
  it("round-trips an edge", () => {
    const rec = edgeToRecord(sampleEdge);
    const restored = recordToEdge(rec);
    expect(restored.id).toBe("edge-1");
    expect(restored.source).toBe("node-1");
    expect(restored.target).toBe("node-2");
    expect(restored.type).toBe("labeled");
    expect(restored.data.label).toBe("queries");
    expect(restored.data.protocol).toBe("HTTP");
    expect(restored.data.format).toBe("JSON");
    expect(restored.data.partitioned).toBe(false);
    expect(restored.data.simulatedLatency).toBe(0);
  });

  it("handles edge with sourceHandle/targetHandle", () => {
    const edge: Edge = { ...sampleEdge, sourceHandle: "right", targetHandle: "left" };
    const rec = edgeToRecord(edge);
    const restored = recordToEdge(rec);
    expect(restored.sourceHandle).toBe("right");
    expect(restored.targetHandle).toBe("left");
  });
});

// ─── Y.Doc bulk operations ──────────────────────────────────────────────

describe("nodesToYMap / yMapToNodes", () => {
  it("round-trips nodes through Y.Doc", () => {
    const doc = new Y.Doc();
    const ymap = doc.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    const nodes = [sampleSystemNode, sampleContainerNode];

    nodesToYMap(nodes, ymap);
    const restored = yMapToNodes(ymap);

    expect(restored).toHaveLength(2);
    const system = restored.find((n) => n.id === "node-1")!;
    const container = restored.find((n) => n.id === "container-1")!;
    expect(system.data.label).toBe("API Gateway");
    expect(system.data.metrics).toEqual({ cpu: 45, memory: 60, requestsPerSec: 1200, latency: 12 });
    expect(container.data.label).toBe("VPC");
    expect(container.zIndex).toBe(-1);
  });

  it("removes nodes no longer in the array", () => {
    const doc = new Y.Doc();
    const ymap = doc.getMap("nodes") as Y.Map<Y.Map<unknown>>;

    nodesToYMap([sampleSystemNode, sampleContainerNode], ymap);
    expect(ymap.size).toBe(2);

    nodesToYMap([sampleSystemNode], ymap);
    expect(ymap.size).toBe(1);
    expect(ymap.has("container-1")).toBe(false);
  });

  it("updates existing node properties", () => {
    const doc = new Y.Doc();
    const ymap = doc.getMap("nodes") as Y.Map<Y.Map<unknown>>;

    nodesToYMap([sampleSystemNode], ymap);
    const updated = {
      ...sampleSystemNode,
      position: { x: 999, y: 888 },
      data: { ...sampleSystemNode.data, label: "Updated" },
    };
    nodesToYMap([updated], ymap);

    const restored = yMapToNodes(ymap);
    expect(restored).toHaveLength(1);
    expect(restored[0].position).toEqual({ x: 999, y: 888 });
    expect(restored[0].data.label).toBe("Updated");
  });
});

describe("edgesToYMap / yMapToEdges", () => {
  it("round-trips edges through Y.Doc", () => {
    const doc = new Y.Doc();
    const ymap = doc.getMap("edges") as Y.Map<Y.Map<unknown>>;

    edgesToYMap([sampleEdge], ymap);
    const restored = yMapToEdges(ymap);

    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe("edge-1");
    expect(restored[0].data.protocol).toBe("HTTP");
  });
});

// ─── Cross-doc sync simulation ──────────────────────────────────────────

describe("two Y.Docs sync via applyUpdate", () => {
  it("changes in doc1 appear in doc2 after applying update", () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    // Sync initial state
    const nodesMap1 = doc1.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    const nodesMap2 = doc2.getMap("nodes") as Y.Map<Y.Map<unknown>>;

    nodesToYMap([sampleSystemNode], nodesMap1);

    // Simulate network: apply doc1's full state to doc2
    const state1 = Y.encodeStateAsUpdate(doc1);
    Y.applyUpdate(doc2, state1);

    const restored = yMapToNodes(nodesMap2);
    expect(restored).toHaveLength(1);
    expect(restored[0].data.label).toBe("API Gateway");
  });

  it("concurrent edits to different nodes merge cleanly", () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const nodesMap1 = doc1.getMap("nodes") as Y.Map<Y.Map<unknown>>;
    const nodesMap2 = doc2.getMap("nodes") as Y.Map<Y.Map<unknown>>;

    // Both start with same state
    nodesToYMap([sampleSystemNode, sampleContainerNode], nodesMap1);
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Doc1 edits system node label
    const entry1 = nodesMap1.get("node-1")!;
    entry1.set("data.label", "Edited by user 1");

    // Doc2 edits container node label
    const entry2 = nodesMap2.get("container-1")!;
    entry2.set("data.label", "Edited by user 2");

    // Exchange updates
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));

    // Both docs should have both edits
    const nodes1 = yMapToNodes(nodesMap1);
    const nodes2 = yMapToNodes(nodesMap2);

    expect(nodes1.find((n) => n.id === "node-1")!.data.label).toBe("Edited by user 1");
    expect(nodes1.find((n) => n.id === "container-1")!.data.label).toBe("Edited by user 2");
    expect(nodes2.find((n) => n.id === "node-1")!.data.label).toBe("Edited by user 1");
    expect(nodes2.find((n) => n.id === "container-1")!.data.label).toBe("Edited by user 2");
  });
});
