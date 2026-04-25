import { describe, it, expect } from "vitest";
import {
  composeSeries,
  composeParallel,
  countNines,
  computeSla,
  formatDowntime,
} from "./sla";

describe("composeSeries", () => {
  it("returns 100 for empty array", () => {
    expect(composeSeries([])).toBe(100);
  });

  it("returns single component availability", () => {
    expect(composeSeries([{ name: "A", availability: 99.9 }])).toBeCloseTo(99.9);
  });

  it("multiplies availabilities", () => {
    const result = composeSeries([
      { name: "A", availability: 99.9 },
      { name: "B", availability: 99.9 },
    ]);
    expect(result).toBeCloseTo(99.8001, 4);
  });

  it("three components in series", () => {
    const result = composeSeries([
      { name: "A", availability: 99.99 },
      { name: "B", availability: 99.99 },
      { name: "C", availability: 99.99 },
    ]);
    expect(result).toBeCloseTo(99.97, 2);
  });
});

describe("composeParallel", () => {
  it("returns 100 for empty array", () => {
    expect(composeParallel([])).toBe(100);
  });

  it("returns single component availability", () => {
    expect(composeParallel([{ name: "A", availability: 99 }])).toBeCloseTo(99);
  });

  it("improves availability with redundancy", () => {
    const result = composeParallel([
      { name: "A", availability: 99 },
      { name: "B", availability: 99 },
    ]);
    // 1 - (0.01 * 0.01) = 0.9999 = 99.99%
    expect(result).toBeCloseTo(99.99, 4);
  });

  it("three parallel components", () => {
    const result = composeParallel([
      { name: "A", availability: 99 },
      { name: "B", availability: 99 },
      { name: "C", availability: 99 },
    ]);
    // 1 - (0.01)^3 = 99.9999%
    expect(result).toBeCloseTo(99.9999, 4);
  });
});

describe("countNines", () => {
  it("handles 100%", () => {
    expect(countNines(100)).toBe("100%");
  });

  it("handles 99%", () => {
    expect(countNines(99)).toBe("two 9s");
  });

  it("handles 99.9%", () => {
    expect(countNines(99.9)).toBe("three 9s");
  });

  it("handles 99.99%", () => {
    expect(countNines(99.99)).toBe("four 9s");
  });

  it("handles 99.999%", () => {
    expect(countNines(99.999)).toBe("five 9s");
  });
});

describe("computeSla", () => {
  it("computes series SLA with downtime", () => {
    const result = computeSla(
      [
        { name: "LB", availability: 99.99 },
        { name: "API", availability: 99.9 },
        { name: "DB", availability: 99.95 },
      ],
      "series",
    );
    expect(result.composite).toBeLessThan(99.9);
    expect(result.downtimeMinutesPerMonth).toBeGreaterThan(0);
    expect(result.downtimeMinutesPerYear).toBeGreaterThan(result.downtimeMinutesPerMonth);
    expect(result.errorBudgetPercent).toBeCloseTo(100 - result.composite);
  });

  it("computes parallel SLA", () => {
    const result = computeSla(
      [
        { name: "DB-primary", availability: 99.9 },
        { name: "DB-replica", availability: 99.9 },
      ],
      "parallel",
    );
    expect(result.composite).toBeCloseTo(99.9999, 3);
  });
});

describe("formatDowntime", () => {
  it("formats seconds", () => {
    expect(formatDowntime(0.5)).toBe("30.0s");
  });

  it("formats minutes", () => {
    expect(formatDowntime(5)).toBe("5.0m");
  });

  it("formats hours", () => {
    expect(formatDowntime(120)).toBe("2.0h");
  });

  it("formats days", () => {
    expect(formatDowntime(1500)).toBe("1.0d");
  });
});
