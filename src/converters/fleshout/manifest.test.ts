import { describe, expect, it } from "vitest";
import { buildHeader, extractPromptHash, sha256Hex, shouldRegenerate } from "./manifest";

describe("sha256Hex", () => {
  it("produces stable hex digests", async () => {
    const a = await sha256Hex("hello");
    const b = await sha256Hex("hello");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs on input change", async () => {
    expect(await sha256Hex("a")).not.toBe(await sha256Hex("b"));
  });
});

describe("buildHeader / extractPromptHash", () => {
  it("round-trips for // comments", () => {
    const h = buildHeader("abc123", "//");
    expect(h).toBe("// flesh-out: abc123\n");
    expect(extractPromptHash(h + "rest of file")).toBe("abc123");
  });

  it("round-trips for # comments", () => {
    const h = buildHeader("abc123", "#");
    expect(extractPromptHash(h + "rest of file")).toBe("abc123");
  });

  it("returns undefined when no header is present", () => {
    expect(extractPromptHash("function foo() {}")).toBeUndefined();
  });
});

describe("shouldRegenerate", () => {
  it("regenerates on missing file", () => {
    expect(shouldRegenerate(undefined, "h1")).toBe(true);
  });

  it("skips when hash matches", () => {
    const file = buildHeader("h1") + "code";
    expect(shouldRegenerate(file, "h1")).toBe(false);
  });

  it("regenerates when hash differs", () => {
    const file = buildHeader("h1") + "code";
    expect(shouldRegenerate(file, "h2")).toBe(true);
  });

  it("regenerates when existing file has no header", () => {
    expect(shouldRegenerate("code without header", "h1")).toBe(true);
  });
});
