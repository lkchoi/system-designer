import { describe, it, expect } from "vitest";
import { analyzeShardKey, type ShardKeyCandidate } from "./shard";

describe("analyzeShardKey", () => {
  it("rates a good shard key highly", () => {
    const candidate: ShardKeyCandidate = {
      name: "user_id",
      cardinality: "high",
      distribution: "uniform",
      queryPattern: "point",
      growthPattern: "random",
    };
    const result = analyzeShardKey(candidate);
    expect(result.overallScore).toBeGreaterThanOrEqual(75);
    expect(result.hotSpotRisk).toBeLessThan(30);
    expect(result.crossShardQueryRisk).toBeLessThan(30);
    expect(result.warnings).toHaveLength(0);
  });

  it("flags timestamp as poor shard key", () => {
    const candidate: ShardKeyCandidate = {
      name: "created_at",
      cardinality: "high",
      distribution: "temporal",
      queryPattern: "range",
      growthPattern: "monotonic",
    };
    const result = analyzeShardKey(candidate);
    expect(result.hotSpotRisk).toBeGreaterThan(50);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("Temporal") || w.includes("Monotonic"))).toBe(
      true,
    );
  });

  it("flags low cardinality", () => {
    const candidate: ShardKeyCandidate = {
      name: "status",
      cardinality: "low",
      distribution: "skewed",
      queryPattern: "point",
      growthPattern: "static",
    };
    const result = analyzeShardKey(candidate);
    expect(result.warnings.some((w) => w.includes("Low cardinality"))).toBe(true);
    expect(result.scalabilityScore).toBeLessThan(50);
  });

  it("flags scatter queries", () => {
    const candidate: ShardKeyCandidate = {
      name: "email",
      cardinality: "high",
      distribution: "uniform",
      queryPattern: "scatter",
      growthPattern: "random",
    };
    const result = analyzeShardKey(candidate);
    expect(result.crossShardQueryRisk).toBeGreaterThanOrEqual(90);
    expect(result.warnings.some((w) => w.includes("Scatter"))).toBe(true);
  });

  it("flags skewed distribution", () => {
    const candidate: ShardKeyCandidate = {
      name: "celebrity_id",
      cardinality: "high",
      distribution: "skewed",
      queryPattern: "point",
      growthPattern: "random",
    };
    const result = analyzeShardKey(candidate);
    expect(result.hotSpotRisk).toBeGreaterThan(20);
    expect(result.warnings.some((w) => w.includes("Skewed"))).toBe(true);
  });

  it("flags range queries on uniform hash keys", () => {
    const candidate: ShardKeyCandidate = {
      name: "id",
      cardinality: "high",
      distribution: "uniform",
      queryPattern: "range",
      growthPattern: "random",
    };
    const result = analyzeShardKey(candidate);
    expect(result.warnings.some((w) => w.includes("Range queries"))).toBe(true);
  });

  it("overall score is between 0 and 100", () => {
    const candidates: ShardKeyCandidate[] = [
      {
        name: "a",
        cardinality: "low",
        distribution: "skewed",
        queryPattern: "scatter",
        growthPattern: "monotonic",
      },
      {
        name: "b",
        cardinality: "high",
        distribution: "uniform",
        queryPattern: "point",
        growthPattern: "random",
      },
    ];
    for (const c of candidates) {
      const r = analyzeShardKey(c);
      expect(r.overallScore).toBeGreaterThanOrEqual(0);
      expect(r.overallScore).toBeLessThanOrEqual(100);
      expect(r.hotSpotRisk).toBeGreaterThanOrEqual(0);
      expect(r.hotSpotRisk).toBeLessThanOrEqual(100);
    }
  });

  it("gives recommendation text", () => {
    const good: ShardKeyCandidate = {
      name: "id",
      cardinality: "high",
      distribution: "uniform",
      queryPattern: "point",
      growthPattern: "random",
    };
    const bad: ShardKeyCandidate = {
      name: "ts",
      cardinality: "low",
      distribution: "temporal",
      queryPattern: "scatter",
      growthPattern: "monotonic",
    };
    expect(analyzeShardKey(good).recommendation).toContain("Good");
    expect(analyzeShardKey(bad).recommendation).toContain("Poor");
  });
});
