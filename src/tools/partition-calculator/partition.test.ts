import { describe, it, expect } from "vitest";
import { computePartitions, formatRate, formatStorage } from "./partition";

const defaults = {
  throughputMBps: 10,
  messageSize: 1024,
  consumerCount: 4,
  consumerThroughputMBps: 2,
  retentionHours: 72,
  replicationFactor: 3,
};

function calc(overrides: Partial<typeof defaults> = {}) {
  return computePartitions({ ...defaults, ...overrides });
}

describe("computePartitions", () => {
  it("computes messages per second", () => {
    const r = calc();
    // 10 MB/s / 1KB = 10240 msg/s
    expect(r.messagesPerSec).toBeCloseTo(10240, 0);
  });

  it("computes min partitions by throughput", () => {
    const r = calc({ throughputMBps: 10, consumerThroughputMBps: 2 });
    expect(r.minPartitionsByThroughput).toBe(5);
  });

  it("computes min partitions by consumers", () => {
    const r = calc({ consumerCount: 8 });
    expect(r.minPartitionsByConsumers).toBe(8);
  });

  it("recommends at least consumer count", () => {
    const r = calc({ consumerCount: 10, throughputMBps: 1, consumerThroughputMBps: 10 });
    expect(r.recommendedPartitions).toBeGreaterThanOrEqual(10);
  });

  it("computes storage with retention", () => {
    const r = calc({ throughputMBps: 1, retentionHours: 24, replicationFactor: 1 });
    // 1 MB/s * 3600 * 24 = 86400 MB ≈ 84.4 GB
    expect(r.totalStorageGB).toBeCloseTo(84.375, 0);
  });

  it("multiplies storage by replication factor", () => {
    const r = calc({ replicationFactor: 3 });
    expect(r.replicatedStorageGB).toBeCloseTo(r.totalStorageGB * 3, 1);
  });

  it("handles zero message size", () => {
    const r = calc({ messageSize: 0 });
    expect(r.messagesPerSec).toBe(0);
  });
});

describe("formatRate", () => {
  it("formats small numbers", () => {
    expect(formatRate(500)).toBe("500");
  });
  it("formats thousands", () => {
    expect(formatRate(10240)).toBe("10.2K");
  });
  it("formats millions", () => {
    expect(formatRate(1500000)).toBe("1.5M");
  });
});

describe("formatStorage", () => {
  it("formats MB", () => {
    expect(formatStorage(0.5)).toBe("512 MB");
  });
  it("formats GB", () => {
    expect(formatStorage(100)).toBe("100.0 GB");
  });
  it("formats TB", () => {
    expect(formatStorage(2048)).toBe("2.00 TB");
  });
});
