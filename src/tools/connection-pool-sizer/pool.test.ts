import { describe, it, expect } from "vitest";
import { computePool } from "./pool";

const defaults = {
  concurrentRequests: 100,
  avgQueryMs: 10,
  serviceInstances: 4,
  maxConnectionsPerDb: 100,
  overheadPercent: 20,
};

function calc(overrides: Partial<typeof defaults> = {}) {
  return computePool({ ...defaults, ...overrides });
}

describe("computePool", () => {
  it("distributes connections across instances", () => {
    const r = calc({ concurrentRequests: 100, serviceInstances: 4 });
    // 100/4 = 25, +20% = 30
    expect(r.connectionsPerInstance).toBe(30);
  });

  it("computes total connections", () => {
    const r = calc({ concurrentRequests: 100, serviceInstances: 4 });
    expect(r.totalConnections).toBe(r.connectionsPerInstance * 4);
  });

  it("detects saturation", () => {
    const r = calc({
      concurrentRequests: 200,
      serviceInstances: 4,
      maxConnectionsPerDb: 50,
    });
    expect(r.saturated).toBe(true);
    expect(r.headroom).toBeLessThan(0);
  });

  it("computes utilization percent", () => {
    const r = calc({
      concurrentRequests: 40,
      serviceInstances: 4,
      maxConnectionsPerDb: 100,
      overheadPercent: 0,
    });
    // 40/4 = 10 per instance, 40 total, 40/100 = 40%
    expect(r.utilizationPercent).toBe(40);
  });

  it("computes max QPS", () => {
    const r = calc({ avgQueryMs: 10 });
    // 1000/10 = 100 QPS per conn
    expect(r.maxQps).toBe(100 * r.totalConnections);
  });

  it("handles single instance", () => {
    const r = calc({ serviceInstances: 1, concurrentRequests: 50, overheadPercent: 0 });
    expect(r.connectionsPerInstance).toBe(50);
    expect(r.totalConnections).toBe(50);
  });

  it("handles zero query time", () => {
    const r = calc({ avgQueryMs: 0 });
    expect(r.maxQps).toBe(0);
  });
});
