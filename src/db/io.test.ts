import { describe, it, expect } from "vitest";
import { parseDesignJSON, type DesignJSON } from "./io";

const validDesign: DesignJSON = {
  version: 1,
  name: "Test Design",
  nodes: [
    {
      id: "n1",
      type: "system",
      position: { x: 0, y: 0 },
      data: { label: "DB", componentType: "database" },
    },
    {
      id: "n2",
      type: "system",
      position: { x: 200, y: 0 },
      data: { label: "Service", componentType: "service" },
    },
  ] as any,
  edges: [{ id: "e1", source: "n1", target: "n2", data: { label: "query" } }] as any,
  viewport: { x: 100, y: 50, zoom: 1.5 },
  flowPaths: [{ id: "fp1", name: "Main Flow", description: "desc", steps: ["n1", "n2"] }],
};

describe("DesignJSON roundtrip", () => {
  it("serializes and parses back faithfully", () => {
    const json = JSON.stringify(validDesign, null, 2);
    const parsed = parseDesignJSON(json);

    expect(parsed.version).toBe(1);
    expect(parsed.name).toBe("Test Design");
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.viewport).toEqual({ x: 100, y: 50, zoom: 1.5 });
    expect(parsed.flowPaths).toHaveLength(1);
    expect(parsed.flowPaths[0].name).toBe("Main Flow");
    expect(parsed.flowPaths[0].steps).toEqual(["n1", "n2"]);
  });

  it("preserves node positions and data", () => {
    const parsed = parseDesignJSON(JSON.stringify(validDesign));
    expect(parsed.nodes[0].data.componentType).toBe("database");
    expect(parsed.nodes[1].position).toEqual({ x: 200, y: 0 });
  });

  it("preserves edge source and target", () => {
    const parsed = parseDesignJSON(JSON.stringify(validDesign));
    expect(parsed.edges[0].source).toBe("n1");
    expect(parsed.edges[0].target).toBe("n2");
  });
});

describe("parseDesignJSON validation", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseDesignJSON("not json")).toThrow();
  });

  it("rejects missing version field", () => {
    expect(() => parseDesignJSON(JSON.stringify({ nodes: [], edges: [] }))).toThrow(
      "Missing version",
    );
  });

  it("rejects missing nodes field", () => {
    expect(() => parseDesignJSON(JSON.stringify({ version: 1, edges: [] }))).toThrow(
      "Missing or invalid nodes",
    );
  });

  it("rejects missing edges field", () => {
    expect(() => parseDesignJSON(JSON.stringify({ version: 1, nodes: [] }))).toThrow(
      "Missing or invalid edges",
    );
  });

  it("rejects nodes that is not an array", () => {
    expect(() =>
      parseDesignJSON(JSON.stringify({ version: 1, nodes: "bad", edges: [] })),
    ).toThrow("Missing or invalid nodes");
  });
});

describe("parseDesignJSON defaults", () => {
  it("defaults name to 'Imported Design' when missing", () => {
    const parsed = parseDesignJSON(JSON.stringify({ version: 1, nodes: [], edges: [] }));
    expect(parsed.name).toBe("Imported Design");
  });

  it("defaults name to 'Imported Design' when empty string", () => {
    const parsed = parseDesignJSON(JSON.stringify({ version: 1, name: "", nodes: [], edges: [] }));
    expect(parsed.name).toBe("Imported Design");
  });

  it("defaults viewport when missing", () => {
    const parsed = parseDesignJSON(JSON.stringify({ version: 1, nodes: [], edges: [] }));
    expect(parsed.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("defaults flowPaths to empty array when missing", () => {
    const parsed = parseDesignJSON(JSON.stringify({ version: 1, nodes: [], edges: [] }));
    expect(parsed.flowPaths).toEqual([]);
  });

  it("uses provided viewport", () => {
    const parsed = parseDesignJSON(
      JSON.stringify({ version: 1, nodes: [], edges: [], viewport: { x: 5, y: 10, zoom: 2 } }),
    );
    expect(parsed.viewport).toEqual({ x: 5, y: 10, zoom: 2 });
  });
});
