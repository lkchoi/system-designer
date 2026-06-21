import { describe, expect, it } from "vitest";
import { dumpYaml, parseYaml } from "./yaml-helpers";

describe("parseYaml", () => {
  it("returns undefined for empty or whitespace input", () => {
    expect(parseYaml(undefined)).toBeUndefined();
    expect(parseYaml("")).toBeUndefined();
    expect(parseYaml("   \n\t  ")).toBeUndefined();
  });

  it("parses valid YAML into objects/arrays/scalars", () => {
    expect(parseYaml<{ a: number }>("a: 1")).toEqual({ a: 1 });
    expect(parseYaml<number[]>("- 1\n- 2\n- 3")).toEqual([1, 2, 3]);
    expect(parseYaml<{ nested: { k: string } }>("nested:\n  k: v")).toEqual({
      nested: { k: "v" },
    });
  });

  it("returns undefined on malformed YAML (does not throw)", () => {
    expect(parseYaml("this: is: : not valid")).toBeUndefined();
    expect(parseYaml("[unclosed")).toBeUndefined();
  });
});

describe("dumpYaml", () => {
  it("serializes objects to YAML", () => {
    const yaml = dumpYaml({ a: 1, b: [2, 3] });
    expect(yaml).toContain("a: 1");
    expect(yaml).toContain("b:");
  });

  it("round-trips with parseYaml", () => {
    const original = { tables: { users: [{ name: "id", type: "uuid" }] } };
    const yaml = dumpYaml(original);
    expect(parseYaml(yaml)).toEqual(original);
  });

  it("does not wrap long lines (lineWidth: -1)", () => {
    const long = "x".repeat(200);
    const yaml = dumpYaml({ field: long });
    // Should be one line for the value, not folded.
    expect(yaml.split("\n").filter((l) => l.includes("x".repeat(200))).length).toBe(1);
  });
});
