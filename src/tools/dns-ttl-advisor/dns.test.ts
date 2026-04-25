import { describe, it, expect } from "vitest";
import { computeDnsTtl, formatTtl } from "./dns";

describe("computeDnsTtl", () => {
  it("recommends 24h for rarely changing records", () => {
    const r = computeDnsTtl({ requestsPerSecond: 100, changeFrequency: "rarely", failoverRequired: false });
    expect(r.recommendedTtl).toBe(86400);
  });

  it("recommends 1h for daily changes", () => {
    const r = computeDnsTtl({ requestsPerSecond: 100, changeFrequency: "daily", failoverRequired: false });
    expect(r.recommendedTtl).toBe(3600);
  });

  it("recommends 5m for hourly changes", () => {
    const r = computeDnsTtl({ requestsPerSecond: 100, changeFrequency: "hourly", failoverRequired: false });
    expect(r.recommendedTtl).toBe(300);
  });

  it("caps at 60s when failover required", () => {
    const r = computeDnsTtl({ requestsPerSecond: 100, changeFrequency: "rarely", failoverRequired: true });
    expect(r.recommendedTtl).toBe(60);
  });

  it("does not cap already-low TTLs for failover", () => {
    const r = computeDnsTtl({ requestsPerSecond: 100, changeFrequency: "minutes", failoverRequired: true });
    expect(r.recommendedTtl).toBe(60);
  });

  it("includes tradeoff description", () => {
    const r = computeDnsTtl({ requestsPerSecond: 100, changeFrequency: "daily", failoverRequired: false });
    expect(r.tradeoff.length).toBeGreaterThan(0);
  });

  it("computes cache benefit", () => {
    const r = computeDnsTtl({ requestsPerSecond: 100, changeFrequency: "daily", failoverRequired: false });
    expect(r.cacheBenefit).toBeGreaterThan(99);
  });
});

describe("formatTtl", () => {
  it("formats seconds", () => {
    expect(formatTtl(30)).toBe("30s");
  });
  it("formats minutes", () => {
    expect(formatTtl(300)).toBe("5m");
  });
  it("formats hours", () => {
    expect(formatTtl(3600)).toBe("1h");
  });
  it("formats days", () => {
    expect(formatTtl(86400)).toBe("1d");
  });
});
