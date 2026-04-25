import { describe, it, expect } from "vitest";
import { projectStorage, formatGB } from "./storage";

describe("projectStorage", () => {
  it("projects 60 months of data", () => {
    const r = projectStorage({
      dailyIngestGB: 10,
      growthRatePercent: 5,
      retentionDays: 365,
      compressionRatio: 2,
      replicationFactor: 3,
    });
    expect(r.projections).toHaveLength(61); // month 0 through 60
  });

  it("computes current retained storage", () => {
    const r = projectStorage({
      dailyIngestGB: 10,
      growthRatePercent: 0,
      retentionDays: 30,
      compressionRatio: 1,
      replicationFactor: 1,
    });
    expect(r.retainedGB).toBe(300); // 10 * 30
  });

  it("applies compression", () => {
    const r = projectStorage({
      dailyIngestGB: 10,
      growthRatePercent: 0,
      retentionDays: 30,
      compressionRatio: 2,
      replicationFactor: 1,
    });
    expect(r.compressedRetainedGB).toBe(150); // 300/2
  });

  it("applies replication", () => {
    const r = projectStorage({
      dailyIngestGB: 10,
      growthRatePercent: 0,
      retentionDays: 30,
      compressionRatio: 1,
      replicationFactor: 3,
    });
    expect(r.replicatedRetainedGB).toBe(900); // 300*3
  });

  it("projects growth over 1 year", () => {
    const r = projectStorage({
      dailyIngestGB: 10,
      growthRatePercent: 10,
      retentionDays: 365,
      compressionRatio: 1,
      replicationFactor: 1,
    });
    // After 12 months at 10% monthly growth: 10 * 1.1^12 ≈ 31.4 GB/day
    expect(r.dailyIngestAfter1y).toBeCloseTo(31.38, 0);
  });

  it("handles zero growth", () => {
    const r = projectStorage({
      dailyIngestGB: 5,
      growthRatePercent: 0,
      retentionDays: 90,
      compressionRatio: 1,
      replicationFactor: 1,
    });
    expect(r.dailyIngestAfter1y).toBe(5);
    expect(r.dailyIngestAfter3y).toBe(5);
  });
});

describe("formatGB", () => {
  it("formats MB", () => {
    expect(formatGB(0.5)).toBe("512 MB");
  });
  it("formats GB", () => {
    expect(formatGB(100)).toBe("100.0 GB");
  });
  it("formats TB", () => {
    expect(formatGB(2048)).toBe("2.00 TB");
  });
  it("formats PB", () => {
    expect(formatGB(1024 * 1024)).toBe("1.00 PB");
  });
});
