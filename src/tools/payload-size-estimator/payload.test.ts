import { describe, it, expect } from "vitest";
import { estimatePayloadSize, formatBytes, type PayloadField } from "./payload";

describe("estimatePayloadSize", () => {
  it("estimates non-zero sizes for typical payload", () => {
    const fields: PayloadField[] = [
      { name: "id", type: "uuid" },
      { name: "name", type: "string", avgLength: 30 },
      { name: "email", type: "string", avgLength: 25 },
      { name: "active", type: "boolean" },
      { name: "score", type: "number" },
      { name: "created", type: "timestamp" },
    ];
    const r = estimatePayloadSize(fields);
    expect(r.jsonBytes).toBeGreaterThan(0);
    expect(r.protobufBytes).toBeGreaterThan(0);
    expect(r.msgpackBytes).toBeGreaterThan(0);
  });

  it("protobuf is smaller than JSON", () => {
    const fields: PayloadField[] = [
      { name: "id", type: "uuid" },
      { name: "name", type: "string", avgLength: 30 },
      { name: "count", type: "number" },
    ];
    const r = estimatePayloadSize(fields);
    expect(r.protobufBytes).toBeLessThan(r.jsonBytes);
    expect(r.savingsProtobuf).toBeGreaterThan(0);
  });

  it("gzip is smaller than raw JSON", () => {
    const fields: PayloadField[] = [
      { name: "name", type: "string", avgLength: 50 },
    ];
    const r = estimatePayloadSize(fields);
    expect(r.gzipJsonBytes).toBeLessThan(r.jsonBytes);
    expect(r.savingsGzip).toBeGreaterThan(0);
  });

  it("handles empty fields", () => {
    const r = estimatePayloadSize([]);
    expect(r.jsonBytes).toBe(2); // just {}
  });

  it("handles nested type", () => {
    const r = estimatePayloadSize([
      { name: "items", type: "nested", count: 10 },
    ]);
    expect(r.jsonBytes).toBeGreaterThan(0);
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });
  it("formats KB", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
  it("formats MB", () => {
    expect(formatBytes(1024 * 1024 * 3)).toBe("3.0 MB");
  });
});
