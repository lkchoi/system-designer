import { describe, it, expect } from "vitest";
import { decodeJwt, timeUntilExpiry } from "./jwt";

// Test JWT: {"alg":"HS256","typ":"JWT"}.{"sub":"1234","name":"Test","iat":1516239022,"exp":1893456000}
const TEST_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0IiwibmFtZSI6IlRlc3QiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTg5MzQ1NjAwMH0.signature";

// Expired JWT: exp = 1000000000 (Sep 2001)
const EXPIRED_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwiZXhwIjoxMDAwMDAwMDAwfQ.sig";

describe("decodeJwt", () => {
  it("decodes a valid JWT", () => {
    const result = decodeJwt(TEST_TOKEN);
    if ("error" in result) throw new Error(result.error);
    expect(result.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(result.payload.sub).toBe("1234");
    expect(result.payload.name).toBe("Test");
    expect(result.signature).toBe("signature");
  });

  it("parses exp and iat", () => {
    const result = decodeJwt(TEST_TOKEN);
    if ("error" in result) throw new Error(result.error);
    expect(result.issuedAt).toBeInstanceOf(Date);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.issuedAt!.getTime()).toBe(1516239022 * 1000);
    expect(result.expiresAt!.getTime()).toBe(1893456000 * 1000);
  });

  it("detects expired token", () => {
    const result = decodeJwt(EXPIRED_TOKEN);
    if ("error" in result) throw new Error(result.error);
    expect(result.isExpired).toBe(true);
  });

  it("detects non-expired token", () => {
    const result = decodeJwt(TEST_TOKEN);
    if ("error" in result) throw new Error(result.error);
    expect(result.isExpired).toBe(false);
  });

  it("rejects invalid format", () => {
    const result = decodeJwt("not-a-jwt");
    expect("error" in result).toBe(true);
  });

  it("rejects two-part token", () => {
    const result = decodeJwt("abc.def");
    expect("error" in result).toBe(true);
  });

  it("handles whitespace", () => {
    const result = decodeJwt(`  ${TEST_TOKEN}  `);
    if ("error" in result) throw new Error(result.error);
    expect(result.payload.sub).toBe("1234");
  });
});

describe("timeUntilExpiry", () => {
  it("returns 'No expiry' for null", () => {
    expect(timeUntilExpiry(null)).toBe("No expiry");
  });

  it("returns 'Expired' for past date", () => {
    expect(timeUntilExpiry(new Date(2000, 0, 1))).toBe("Expired");
  });

  it("formats future date", () => {
    const future = new Date(Date.now() + 3600 * 1000);
    const result = timeUntilExpiry(future);
    expect(result).toMatch(/\d+h|\d+m/);
  });
});
