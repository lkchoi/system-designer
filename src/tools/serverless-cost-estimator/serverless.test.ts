import { describe, it, expect } from "vitest";
import { computeServerlessCost, formatCost } from "./serverless";

describe("computeServerlessCost", () => {
  it("computes GB-seconds", () => {
    const r = computeServerlessCost({
      invocationsPerMonth: 1_000_000,
      avgDurationMs: 200,
      memoryMB: 512,
      provider: "aws",
    });
    // 1M * 0.2s * 0.5GB = 100,000 GB-s
    expect(r.gbSeconds).toBeCloseTo(100_000, 0);
  });

  it("subtracts free tier", () => {
    const r = computeServerlessCost({
      invocationsPerMonth: 500_000,
      avgDurationMs: 100,
      memoryMB: 128,
      provider: "aws",
    });
    // GB-s = 500K * 0.1 * 0.125 = 6250, under free tier of 400K
    // Requests = 500K, under free tier of 1M
    expect(r.totalCost).toBe(0);
  });

  it("charges above free tier", () => {
    const r = computeServerlessCost({
      invocationsPerMonth: 10_000_000,
      avgDurationMs: 500,
      memoryMB: 1024,
      provider: "aws",
    });
    expect(r.totalCost).toBeGreaterThan(0);
    expect(r.computeCost).toBeGreaterThan(0);
    expect(r.requestCost).toBeGreaterThan(0);
  });

  it("works for GCP", () => {
    const r = computeServerlessCost({
      invocationsPerMonth: 5_000_000,
      avgDurationMs: 200,
      memoryMB: 256,
      provider: "gcp",
    });
    expect(r.totalCost).toBeGreaterThanOrEqual(0);
  });

  it("works for Cloudflare", () => {
    const r = computeServerlessCost({
      invocationsPerMonth: 5_000_000,
      avgDurationMs: 50,
      memoryMB: 128,
      provider: "cloudflare",
    });
    expect(r.totalCost).toBeGreaterThanOrEqual(0);
  });

  it("tracks free tier savings", () => {
    const r = computeServerlessCost({
      invocationsPerMonth: 10_000_000,
      avgDurationMs: 500,
      memoryMB: 1024,
      provider: "aws",
    });
    expect(r.freeComputeSavings).toBeGreaterThan(0);
    expect(r.freeRequestSavings).toBeGreaterThan(0);
  });
});

describe("formatCost", () => {
  it("formats tiny amounts", () => {
    expect(formatCost(0.001)).toBe("$0.0010");
  });
  it("formats cents", () => {
    expect(formatCost(0.5)).toBe("$0.50");
  });
  it("formats dollars", () => {
    expect(formatCost(42.5)).toBe("$42.50");
  });
  it("formats large amounts", () => {
    expect(formatCost(1234.56)).toMatch(/\$1,?234\.56/);
  });
});
