import { describe, it, expect } from "vitest";
import { quorumSize, computeReplication } from "./replication";

describe("quorumSize", () => {
  it("ONE requires 1 regardless of RF", () => {
    expect(quorumSize(3, "one")).toBe(1);
    expect(quorumSize(5, "one")).toBe(1);
  });

  it("ALL requires all replicas", () => {
    expect(quorumSize(3, "all")).toBe(3);
    expect(quorumSize(5, "all")).toBe(5);
  });

  it("QUORUM is majority", () => {
    expect(quorumSize(3, "quorum")).toBe(2);
    expect(quorumSize(5, "quorum")).toBe(3);
    expect(quorumSize(7, "quorum")).toBe(4);
  });
});

describe("computeReplication", () => {
  it("RF=3 QUORUM is strongly consistent", () => {
    const r = computeReplication({ nodeCount: 5, replicationFactor: 3, consistencyLevel: "quorum" });
    expect(r.readQuorum).toBe(2);
    expect(r.writeQuorum).toBe(2);
    expect(r.stronglyConsistent).toBe(true); // 2+2=4 > 3
  });

  it("RF=3 ONE is not strongly consistent", () => {
    const r = computeReplication({ nodeCount: 5, replicationFactor: 3, consistencyLevel: "one" });
    expect(r.stronglyConsistent).toBe(false); // 1+1=2 < 3
  });

  it("RF=3 ALL is strongly consistent", () => {
    const r = computeReplication({ nodeCount: 5, replicationFactor: 3, consistencyLevel: "all" });
    expect(r.stronglyConsistent).toBe(true); // 3+3=6 > 3
  });

  it("tolerates correct number of failures", () => {
    const r = computeReplication({ nodeCount: 5, replicationFactor: 3, consistencyLevel: "quorum" });
    expect(r.toleratedReadFailures).toBe(1); // 3-2
    expect(r.toleratedWriteFailures).toBe(1);
  });

  it("ONE tolerates most failures", () => {
    const r = computeReplication({ nodeCount: 5, replicationFactor: 5, consistencyLevel: "one" });
    expect(r.toleratedReadFailures).toBe(4); // 5-1
  });

  it("ALL tolerates zero failures", () => {
    const r = computeReplication({ nodeCount: 3, replicationFactor: 3, consistencyLevel: "all" });
    expect(r.toleratedReadFailures).toBe(0);
  });

  it("caps RF at node count", () => {
    const r = computeReplication({ nodeCount: 2, replicationFactor: 5, consistencyLevel: "quorum" });
    expect(r.readQuorum).toBe(2); // quorum of min(5,2) = 2
  });

  it("computes availability > 99%", () => {
    const r = computeReplication({ nodeCount: 5, replicationFactor: 3, consistencyLevel: "quorum" });
    expect(r.readAvailability).toBeGreaterThan(99);
    expect(r.writeAvailability).toBeGreaterThan(99);
  });
});
