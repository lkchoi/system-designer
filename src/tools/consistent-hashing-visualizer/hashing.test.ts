import { describe, it, expect } from "vitest";
import {
  hashToRing,
  buildRing,
  computeRedistribution,
  generateKeys,
  type RingNode,
} from "./hashing";

const nodes: RingNode[] = [
  { id: "A", label: "Node A", color: "#6366f1" },
  { id: "B", label: "Node B", color: "#22c55e" },
  { id: "C", label: "Node C", color: "#f97316" },
];

describe("hashToRing", () => {
  it("returns value between 0 and 1", () => {
    const h = hashToRing("test-key");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(1);
  });

  it("is deterministic", () => {
    expect(hashToRing("foo")).toBe(hashToRing("foo"));
  });

  it("produces different values for different inputs", () => {
    expect(hashToRing("a")).not.toBe(hashToRing("b"));
  });
});

describe("buildRing", () => {
  it("creates vnodes for each node", () => {
    const ring = buildRing(nodes, 10, []);
    expect(ring.vnodes).toHaveLength(30); // 3 nodes * 10 vnodes
  });

  it("vnodes are sorted by position", () => {
    const ring = buildRing(nodes, 50, []);
    for (let i = 1; i < ring.vnodes.length; i++) {
      expect(ring.vnodes[i].position).toBeGreaterThanOrEqual(ring.vnodes[i - 1].position);
    }
  });

  it("assigns all keys to a node", () => {
    const keys = generateKeys(100);
    const ring = buildRing(nodes, 10, keys);
    expect(ring.keys).toHaveLength(100);
    for (const k of ring.keys) {
      expect(nodes.some((n) => n.id === k.assignedTo)).toBe(true);
    }
  });

  it("distribution sums to total keys", () => {
    const keys = generateKeys(100);
    const ring = buildRing(nodes, 10, keys);
    const total = [...ring.distribution.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it("more vnodes produce more even distribution", () => {
    const keys = generateKeys(1000);
    const ring10 = buildRing(nodes, 10, keys);
    const ring200 = buildRing(nodes, 200, keys);
    // Standard deviation should be lower with more vnodes
    expect(ring200.standardDeviation).toBeLessThan(ring10.standardDeviation);
  });

  it("handles empty nodes", () => {
    const ring = buildRing([], 10, ["key1"]);
    expect(ring.vnodes).toHaveLength(0);
    expect(ring.keys[0].assignedTo).toBe("");
  });

  it("handles empty keys", () => {
    const ring = buildRing(nodes, 10, []);
    expect(ring.keys).toHaveLength(0);
    expect(ring.standardDeviation).toBe(0);
  });
});

describe("computeRedistribution", () => {
  it("adding a node moves some keys", () => {
    const keys = generateKeys(1000);
    const before = buildRing(nodes, 50, keys);
    const after = buildRing(
      [...nodes, { id: "D", label: "Node D", color: "#ec4899" }],
      50,
      keys,
    );
    const result = computeRedistribution(before, after);
    expect(result.moved).toBeGreaterThan(0);
    expect(result.moved).toBeLessThan(1000);
    // Ideally ~K/N keys move (1000/4 = 250), allow wide range
    expect(result.percent).toBeGreaterThan(10);
    expect(result.percent).toBeLessThan(50);
  });

  it("removing a node moves some keys", () => {
    const keys = generateKeys(1000);
    const before = buildRing(nodes, 50, keys);
    const after = buildRing(nodes.slice(0, 2), 50, keys);
    const result = computeRedistribution(before, after);
    expect(result.moved).toBeGreaterThan(0);
    // Removing 1 of 3 nodes should move ~1/3 of keys
    expect(result.percent).toBeGreaterThan(20);
    expect(result.percent).toBeLessThan(50);
  });

  it("no change means no keys move", () => {
    const keys = generateKeys(100);
    const ring = buildRing(nodes, 50, keys);
    const result = computeRedistribution(ring, ring);
    expect(result.moved).toBe(0);
  });
});

describe("generateKeys", () => {
  it("generates requested count", () => {
    expect(generateKeys(50)).toHaveLength(50);
  });

  it("generates unique keys", () => {
    const keys = generateKeys(100);
    expect(new Set(keys).size).toBe(100);
  });
});
