import { describe, it, expect } from "vitest";
import { resolveImport } from "./resolve-import";
import { getImportFormats } from "./index";

const importFormats = getImportFormats();

function resolve(content: string, filename: string) {
  return resolveImport(content, filename, importFormats);
}

describe("resolveImport — errors", () => {
  it("throws a readable error for malformed native JSON", () => {
    expect(() => resolve("{ not json", "design.json")).toThrow();
  });

  it("throws for JSON that is missing required design fields", () => {
    // Detected as native-json (default for .json) → parseDesignJSON validates.
    expect(() => resolve(JSON.stringify({ version: 1, nodes: [] }), "design.json")).toThrow(
      /edges/i,
    );
    expect(() => resolve(JSON.stringify({ nodes: [], edges: [] }), "design.json")).toThrow(
      /version/i,
    );
  });

  it("throws when the detected format has no available importer", () => {
    // A CloudFormation file is detected as "cloudformation"; with that converter
    // absent from the list, there is no importer to handle it.
    const formatsWithoutCfn = importFormats.filter((c) => c.id !== "cloudformation");
    const cfn = JSON.stringify({ AWSTemplateFormatVersion: "2010-09-09", Resources: {} });
    expect(() => resolveImport(cfn, "stack.json", formatsWithoutCfn)).toThrow(
      /no importer is available for cloudformation/i,
    );
  });

  it("surfaces converter-thrown errors instead of swallowing them", () => {
    expect(() => resolve("type: : : invalid yaml", "stack.yaml")).toThrow();
  });
});

describe("resolveImport — warnings", () => {
  it("warns when an import yields zero components", () => {
    const empty = JSON.stringify({ version: 1, name: "Empty", nodes: [], edges: [] });
    const { design, warnings } = resolve(empty, "empty.json");
    expect(design.nodes).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/no components were recognized/i);
  });

  it("warns when an Excalidraw file has no importable shapes", () => {
    const blank = JSON.stringify({ type: "excalidraw", version: 2, elements: [] });
    const { design, warnings } = resolve(blank, "blank.excalidraw");
    expect(design.nodes).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });
});

describe("resolveImport — success", () => {
  it("returns the design with no warnings for a valid native file", () => {
    const native = JSON.stringify({
      version: 1,
      name: "Valid",
      nodes: [{ id: "n1", type: "system", position: { x: 0, y: 0 }, data: { label: "api" } }],
      edges: [],
    });
    const { design, warnings } = resolve(native, "design.json");
    expect(design.name).toBe("Valid");
    expect(design.nodes).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it("converts a non-native format and reports no warnings when shapes exist", () => {
    // A bare Excalidraw rectangle is mapped to a system node by the importer.
    const excalidraw = JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "rect1",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 180,
          height: 50,
          strokeStyle: "solid",
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
        },
      ],
    });
    const { design, warnings } = resolve(excalidraw, "diagram.excalidraw");
    expect(design.nodes.length).toBeGreaterThan(0);
    expect(design.nodes[0].type).toBe("system");
    expect(warnings).toHaveLength(0);
  });
});
