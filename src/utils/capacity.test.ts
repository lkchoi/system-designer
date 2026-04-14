import { describe, it, expect } from "vitest";
import {
  computeCapacity,
  formatDataSize,
  formatTB,
  formatBandwidth,
  formatNumber,
  formatBytes,
  type CapacityInputs,
} from "./capacity";

const defaults: CapacityInputs = {
  tps: 1000,
  payloadSize: 1,
  payloadUnit: "KB",
  replicationFactor: 3,
  readWriteRatio: 4,
  retentionDays: 90,
};

function calc(overrides: Partial<CapacityInputs> = {}) {
  return computeCapacity({ ...defaults, ...overrides });
}

// ---------------------------------------------------------------------------
// computeCapacity
// ---------------------------------------------------------------------------
describe("computeCapacity", () => {
  it("computes bytes per second from TPS and payload", () => {
    const r = calc({ tps: 1000, payloadSize: 1, payloadUnit: "KB" });
    expect(r.bytesPerSec).toBe(1000 * 1024);
  });

  it("handles bytes unit", () => {
    const r = calc({ tps: 500, payloadSize: 256, payloadUnit: "B" });
    expect(r.bytesPerSec).toBe(500 * 256);
  });

  it("handles MB unit", () => {
    const r = calc({ tps: 10, payloadSize: 2, payloadUnit: "MB" });
    expect(r.bytesPerSec).toBe(10 * 2 * 1024 * 1024);
  });

  it("computes daily/monthly/yearly volumes", () => {
    const r = calc({ tps: 1000, payloadSize: 1, payloadUnit: "KB" });
    const expectedDaily = (1000 * 1024 * 86_400) / 1024 ** 3;
    expect(r.dailyGB).toBeCloseTo(expectedDaily);
    expect(r.monthlyGB).toBeCloseTo(expectedDaily * 30);
    expect(r.yearlyTB).toBeCloseTo((expectedDaily * 365) / 1024);
  });

  it("applies replication factor to volumes", () => {
    const r = calc({ replicationFactor: 3 });
    expect(r.dailyReplicatedGB).toBeCloseTo(r.dailyGB * 3);
    expect(r.monthlyReplicatedGB).toBeCloseTo(r.monthlyGB * 3);
    expect(r.yearlyReplicatedTB).toBeCloseTo(r.yearlyTB * 3);
  });

  it("clamps replication factor to minimum 1", () => {
    const r = calc({ replicationFactor: 0 });
    expect(r.dailyReplicatedGB).toBe(r.dailyGB);
  });

  it("computes bandwidth in Mbps", () => {
    const r = calc({ tps: 1000, payloadSize: 1, payloadUnit: "KB" });
    expect(r.bandwidthMbps).toBeCloseTo((1000 * 1024 * 8) / 1e6);
  });

  it("applies replication to bandwidth", () => {
    const r = calc({ replicationFactor: 3 });
    expect(r.bandwidthReplicatedMbps).toBeCloseTo(r.bandwidthMbps * 3);
  });

  it("computes storage projections (1y/3y/5y)", () => {
    const r = calc();
    const dailyReplicatedTB = r.dailyReplicatedGB / 1024;
    expect(r.storage1y).toBeCloseTo(dailyReplicatedTB * 365);
    expect(r.storage3y).toBeCloseTo(dailyReplicatedTB * 365 * 3);
    expect(r.storage5y).toBeCloseTo(dailyReplicatedTB * 365 * 5);
  });

  it("computes retention storage", () => {
    const r = calc({ retentionDays: 90 });
    const dailyReplicatedTB = r.dailyReplicatedGB / 1024;
    expect(r.retentionStorageTB).toBeCloseTo(dailyReplicatedTB * 90);
  });

  it("splits reads and writes by ratio", () => {
    // ratio 4 means 4 reads per 1 write, so 1/5 writes, 4/5 reads
    const r = calc({ tps: 1000, readWriteRatio: 4 });
    expect(r.writesPerSec).toBeCloseTo(200);
    expect(r.readsPerSec).toBeCloseTo(800);
  });

  it("handles 0 read:write ratio (all writes)", () => {
    const r = calc({ tps: 1000, readWriteRatio: 0 });
    expect(r.writesPerSec).toBeCloseTo(1000);
    expect(r.readsPerSec).toBeCloseTo(0);
  });

  it("handles 1:1 read:write ratio", () => {
    const r = calc({ tps: 1000, readWriteRatio: 1 });
    expect(r.writesPerSec).toBeCloseTo(500);
    expect(r.readsPerSec).toBeCloseTo(500);
  });

  it("computes DynamoDB WCUs (1KB per WCU)", () => {
    // 1KB payload: multiplier = ceil(1024/1024) = 1
    const r = calc({
      tps: 1000,
      payloadSize: 1,
      payloadUnit: "KB",
      readWriteRatio: 4,
    });
    expect(r.wcus).toBe(Math.ceil(200 * 1));
  });

  it("computes DynamoDB RCUs (4KB per RCU)", () => {
    // 1KB payload: multiplier = ceil(1024/4096) = 1
    const r = calc({
      tps: 1000,
      payloadSize: 1,
      payloadUnit: "KB",
      readWriteRatio: 4,
    });
    expect(r.rcus).toBe(Math.ceil(800 * 1));
  });

  it("scales WCU/RCU multipliers for larger payloads", () => {
    // 5KB payload: WCU multiplier = ceil(5120/1024) = 5, RCU multiplier = ceil(5120/4096) = 2
    const r = calc({
      tps: 100,
      payloadSize: 5,
      payloadUnit: "KB",
      readWriteRatio: 1,
    });
    expect(r.wcus).toBe(Math.ceil(50 * 5));
    expect(r.rcus).toBe(Math.ceil(50 * 2));
  });

  it("handles zero TPS", () => {
    const r = calc({ tps: 0 });
    expect(r.bytesPerSec).toBe(0);
    expect(r.dailyGB).toBe(0);
    expect(r.wcus).toBe(0);
    expect(r.rcus).toBe(0);
  });

  it("handles zero payload size", () => {
    const r = calc({ payloadSize: 0 });
    expect(r.bytesPerSec).toBe(0);
    expect(r.dailyGB).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatDataSize
// ---------------------------------------------------------------------------
describe("formatDataSize", () => {
  it("formats sub-MB as KB", () => {
    expect(formatDataSize(0.0005)).toBe("524 KB");
  });

  it("formats sub-GB as MB", () => {
    expect(formatDataSize(0.5)).toBe("512.0 MB");
  });

  it("formats GB range", () => {
    expect(formatDataSize(42)).toBe("42.0 GB");
  });

  it("formats TB range", () => {
    expect(formatDataSize(2048)).toBe("2.00 TB");
  });

  it("formats PB range", () => {
    expect(formatDataSize(1024 * 1024 * 2)).toBe("2.00 PB");
  });
});

// ---------------------------------------------------------------------------
// formatTB
// ---------------------------------------------------------------------------
describe("formatTB", () => {
  it("formats sub-GB as KB", () => {
    expect(formatTB(0.0005)).toBe("524 KB");
  });

  it("formats sub-TB as GB", () => {
    expect(formatTB(0.5)).toBe("512.0 GB");
  });

  it("formats TB range", () => {
    expect(formatTB(42)).toBe("42.00 TB");
  });

  it("formats PB range", () => {
    expect(formatTB(1024 * 2)).toBe("2.00 PB");
  });
});

// ---------------------------------------------------------------------------
// formatBandwidth
// ---------------------------------------------------------------------------
describe("formatBandwidth", () => {
  it("formats sub-Mbps as Kbps", () => {
    expect(formatBandwidth(0.5)).toBe("500 Kbps");
  });

  it("formats Mbps range", () => {
    expect(formatBandwidth(42)).toBe("42.0 Mbps");
  });

  it("formats Gbps range", () => {
    expect(formatBandwidth(2500)).toBe("2.50 Gbps");
  });
});

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------
describe("formatNumber", () => {
  it("formats millions", () => {
    expect(formatNumber(2_500_000)).toBe("2.5M");
  });

  it("formats tens of thousands", () => {
    expect(formatNumber(50_000)).toBe("50.0K");
  });

  it("formats thousands with commas", () => {
    expect(formatNumber(5_000)).toBe("5,000");
  });

  it("formats small integers", () => {
    expect(formatNumber(42)).toBe("42");
  });

  it("formats small decimals with one digit", () => {
    expect(formatNumber(3.7)).toBe("3.7");
  });
});

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------
describe("formatBytes", () => {
  it("formats bytes per second", () => {
    expect(formatBytes(500)).toBe("500 B/s");
  });

  it("formats KB/s", () => {
    expect(formatBytes(2048)).toBe("2.0 KB/s");
  });

  it("formats MB/s", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB/s");
  });

  it("formats GB/s", () => {
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.00 GB/s");
  });
});
