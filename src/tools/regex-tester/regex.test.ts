import { describe, it, expect } from "vitest";
import { testRegex } from "./regex";

describe("testRegex", () => {
  it("returns empty for empty pattern", () => {
    const r = testRegex("", "g", "hello");
    expect(r.matches).toHaveLength(0);
    expect(r.isValid).toBe(true);
  });

  it("finds simple matches", () => {
    const r = testRegex("\\d+", "g", "abc 123 def 456");
    expect(r.matchCount).toBe(2);
    expect(r.matches[0].text).toBe("123");
    expect(r.matches[1].text).toBe("456");
  });

  it("captures groups", () => {
    const r = testRegex("(\\w+)@(\\w+)", "", "user@host");
    expect(r.matchCount).toBe(1);
    expect(r.matches[0].groups).toEqual(["user", "host"]);
  });

  it("reports match index", () => {
    const r = testRegex("world", "", "hello world");
    expect(r.matches[0].index).toBe(6);
  });

  it("handles no matches", () => {
    const r = testRegex("xyz", "g", "hello world");
    expect(r.matchCount).toBe(0);
    expect(r.isValid).toBe(true);
  });

  it("reports invalid regex", () => {
    const r = testRegex("[invalid", "", "test");
    expect(r.isValid).toBe(false);
    expect(r.error).not.toBeNull();
  });

  it("handles case insensitive flag", () => {
    const r = testRegex("hello", "gi", "Hello HELLO hello");
    expect(r.matchCount).toBe(3);
  });

  it("handles zero-length matches without infinite loop", () => {
    const r = testRegex("^", "gm", "line1\nline2");
    expect(r.matchCount).toBe(2);
  });

  it("single match without global flag", () => {
    const r = testRegex("\\d+", "", "abc 123 def 456");
    expect(r.matchCount).toBe(1);
    expect(r.matches[0].text).toBe("123");
  });
});
