import { describe, it, expect } from "vitest";
import { computeLatencyBudget, percentOfBudget } from "./latency";

describe("computeLatencyBudget", () => {
  it("sums p50 and p99", () => {
    const r = computeLatencyBudget(
      [
        { name: "A", p50Ms: 10, p99Ms: 50 },
        { name: "B", p50Ms: 5, p99Ms: 30 },
      ],
      200,
    );
    expect(r.totalP50).toBe(15);
    expect(r.totalP99).toBe(80);
  });

  it("computes remaining budget", () => {
    const r = computeLatencyBudget([{ name: "A", p50Ms: 50, p99Ms: 150 }], 200);
    expect(r.remainingP50).toBe(150);
    expect(r.remainingP99).toBe(50);
  });

  it("detects within budget", () => {
    const r = computeLatencyBudget([{ name: "A", p50Ms: 50, p99Ms: 100 }], 200);
    expect(r.withinBudgetP50).toBe(true);
    expect(r.withinBudgetP99).toBe(true);
  });

  it("detects over budget", () => {
    const r = computeLatencyBudget([{ name: "A", p50Ms: 50, p99Ms: 250 }], 200);
    expect(r.withinBudgetP50).toBe(true);
    expect(r.withinBudgetP99).toBe(false);
  });

  it("handles empty hops", () => {
    const r = computeLatencyBudget([], 200);
    expect(r.totalP50).toBe(0);
    expect(r.totalP99).toBe(0);
    expect(r.remainingP50).toBe(200);
  });
});

describe("percentOfBudget", () => {
  it("computes percentage", () => {
    expect(percentOfBudget(50, 200)).toBe(25);
  });

  it("handles zero budget", () => {
    expect(percentOfBudget(50, 0)).toBe(0);
  });

  it("handles over 100%", () => {
    expect(percentOfBudget(300, 200)).toBe(150);
  });
});
