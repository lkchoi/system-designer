import { describe, it, expect } from "vitest";
import { computeCache, formatMemory } from "./cache";

const defaults = {
  objectCount: 1_000_000,
  avgObjectSizeBytes: 1024,
  ttlSeconds: 3600,
  hitRate: 95,
  writeRate: 1000,
  overheadPercent: 20,
};

function calc(overrides: Partial<typeof defaults> = {}) {
  return computeCache({ ...defaults, ...overrides });
}

describe("computeCache", () => {
  it("computes raw memory", () => {
    const r = calc();
    // 1M * 1KB = ~976 MB
    expect(r.rawMemoryMB).toBeCloseTo(976.56, 0);
  });

  it("adds overhead", () => {
    const r = calc();
    expect(r.withOverheadMB).toBeCloseTo(r.rawMemoryMB * 1.2, 1);
  });

  it("computes eviction rate from TTL", () => {
    const r = calc();
    // 1M objects / 3600s ≈ 277.8/sec
    expect(r.evictionsPerSec).toBeCloseTo(277.78, 0);
  });

  it("handles zero TTL", () => {
    const r = calc({ ttlSeconds: 0 });
    expect(r.evictionsPerSec).toBe(0);
  });

  it("computes miss rate", () => {
    const r = calc({ hitRate: 95 });
    expect(r.missRate).toBe(5);
  });

  it("computes origin reads from misses", () => {
    const r = calc({ hitRate: 90, writeRate: 1000 });
    // 10% miss * 1000 writes/sec = 100 origin reads/sec
    expect(r.readsFromOriginPerSec).toBe(100);
  });

  it("100% hit rate means zero origin reads", () => {
    const r = calc({ hitRate: 100 });
    expect(r.readsFromOriginPerSec).toBe(0);
  });
});

describe("formatMemory", () => {
  it("formats KB", () => {
    expect(formatMemory(0.5)).toBe("512 KB");
  });

  it("formats MB", () => {
    expect(formatMemory(100)).toBe("100.0 MB");
  });

  it("formats GB", () => {
    expect(formatMemory(2048)).toBe("2.00 GB");
  });

  it("formats TB", () => {
    expect(formatMemory(1024 * 1024)).toBe("1.00 TB");
  });
});
