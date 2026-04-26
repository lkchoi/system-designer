import { describe, it, expect } from "vitest";
import { excalidrawConverter } from "./excalidraw";
import type { DesignJSON } from "../db/io";

const SAMPLE_DESIGN: DesignJSON = {
  version: 1,
  name: "TestDesign",
  nodes: [
    {
      id: "svc",
      type: "system",
      position: { x: 100, y: 100 },
      data: {
        label: "API",
        description: "REST API",
        componentType: "service",
        plan: { technology: "Node.js (Express/Fastify)" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "db",
      type: "system",
      position: { x: 400, y: 100 },
      data: {
        label: "OrdersDB",
        componentType: "database",
        plan: { technology: "PostgreSQL" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "container",
      type: "container",
      position: { x: 50, y: 50 },
      style: { width: 600, height: 300 },
      data: { label: "Backend", color: "rgba(99,102,241,0.04)", collapsed: false },
    },
    {
      id: "sticky",
      type: "sticky",
      position: { x: 700, y: 100 },
      style: { width: 150, height: 100 },
      data: { text: "TODO: add caching", color: "#fde68a" },
    },
    {
      id: "text",
      type: "text",
      position: { x: 700, y: 300 },
      data: { text: "Architecture v2", size: "large" },
    },
  ] as unknown as DesignJSON["nodes"],
  edges: [
    {
      id: "e1",
      source: "svc",
      target: "db",
      type: "labeled",
      data: { label: "queries", protocol: "TCP", format: "JSON" },
    },
  ] as unknown as DesignJSON["edges"],
  viewport: { x: 0, y: 0, zoom: 1 },
  flowPaths: [],
};

describe("excalidraw converter — export", () => {
  function parseExport(design: DesignJSON): {
    type: string;
    version: number;
    source: string;
    elements: Array<Record<string, unknown>>;
  } {
    const json = excalidrawConverter.exportDesign(design).content as string;
    return JSON.parse(json);
  }

  it("returns .excalidraw filename with application/json mimeType", () => {
    const result = excalidrawConverter.exportDesign(SAMPLE_DESIGN);
    expect(result.filename).toBe("TestDesign.excalidraw");
    expect(result.mimeType).toBe("application/json");
  });

  it("produces valid excalidraw JSON structure", () => {
    const parsed = parseExport(SAMPLE_DESIGN);
    expect(parsed.type).toBe("excalidraw");
    expect(parsed.version).toBe(2);
    expect(parsed.source).toBe("arkon");
    expect(Array.isArray(parsed.elements)).toBe(true);
  });

  it("creates a rectangle + text for each system node", () => {
    const parsed = parseExport(SAMPLE_DESIGN);
    const svcRect = parsed.elements.find((e) => e.id === "svc");
    const svcText = parsed.elements.find((e) => e.id === "svc_text");
    expect(svcRect).toBeDefined();
    expect(svcRect!.type).toBe("rectangle");
    expect(svcText).toBeDefined();
    expect(svcText!.type).toBe("text");
  });

  it("includes description in system node label text", () => {
    const parsed = parseExport(SAMPLE_DESIGN);
    const svcText = parsed.elements.find((e) => e.id === "svc_text");
    expect(svcText!.text).toContain("API");
    expect(svcText!.text).toContain("REST API");
  });

  it("creates a dashed rectangle for container nodes", () => {
    const parsed = parseExport(SAMPLE_DESIGN);
    const containerRect = parsed.elements.find((e) => e.id === "container");
    expect(containerRect).toBeDefined();
    expect(containerRect!.type).toBe("rectangle");
    expect(containerRect!.strokeStyle).toBe("dashed");
  });

  it("creates a colored rectangle for sticky nodes", () => {
    const parsed = parseExport(SAMPLE_DESIGN);
    const stickyRect = parsed.elements.find((e) => e.id === "sticky");
    expect(stickyRect).toBeDefined();
    expect(stickyRect!.backgroundColor).toBe("#fde68a");
  });

  it("creates a text element for text nodes", () => {
    const parsed = parseExport(SAMPLE_DESIGN);
    const textEl = parsed.elements.find((e) => e.id === "text");
    expect(textEl).toBeDefined();
    expect(textEl!.type).toBe("text");
    expect(textEl!.text).toBe("Architecture v2");
    expect(textEl!.fontSize).toBe(24); // "large" → 24
  });

  it("creates an arrow for each edge", () => {
    const parsed = parseExport(SAMPLE_DESIGN);
    const arrow = parsed.elements.find((e) => e.id === "e1");
    expect(arrow).toBeDefined();
    expect(arrow!.type).toBe("arrow");
    expect(arrow!.endArrowhead).toBe("arrow");
  });

  it("binds arrow to source and target nodes", () => {
    const parsed = parseExport(SAMPLE_DESIGN);
    const arrow = parsed.elements.find((e) => e.id === "e1");
    const startBinding = arrow!.startBinding as { elementId: string };
    const endBinding = arrow!.endBinding as { elementId: string };
    expect(startBinding.elementId).toBe("svc");
    expect(endBinding.elementId).toBe("db");
  });

  it("creates a label text element for edges with metadata", () => {
    const parsed = parseExport(SAMPLE_DESIGN);
    const edgeText = parsed.elements.find((e) => e.id === "e1_text");
    expect(edgeText).toBeDefined();
    expect(edgeText!.text).toContain("queries");
    expect(edgeText!.text).toContain("TCP");
    expect(edgeText!.text).toContain("JSON");
  });
});

describe("excalidraw converter — import", () => {
  it("round-trips a design through export then import", () => {
    const exported = excalidrawConverter.exportDesign(SAMPLE_DESIGN).content as string;
    const imported = excalidrawConverter.importDesign!(exported);
    expect(imported.name).toBe("Imported from Excalidraw");
    expect(imported.nodes.length).toBeGreaterThan(0);
    expect(imported.edges.length).toBeGreaterThan(0);
  });

  it("recovers system nodes from rectangles", () => {
    const exported = excalidrawConverter.exportDesign(SAMPLE_DESIGN).content as string;
    const imported = excalidrawConverter.importDesign!(exported);
    const systemNodes = imported.nodes.filter((n) => n.type === "system");
    expect(systemNodes.length).toBeGreaterThanOrEqual(2);
  });

  it("recovers container nodes from dashed rectangles", () => {
    const exported = excalidrawConverter.exportDesign(SAMPLE_DESIGN).content as string;
    const imported = excalidrawConverter.importDesign!(exported);
    const containers = imported.nodes.filter((n) => n.type === "container");
    expect(containers.length).toBe(1);
  });

  it("recovers sticky notes from colored rectangles", () => {
    const exported = excalidrawConverter.exportDesign(SAMPLE_DESIGN).content as string;
    const imported = excalidrawConverter.importDesign!(exported);
    const stickies = imported.nodes.filter((n) => n.type === "sticky");
    expect(stickies.length).toBe(1);
  });

  it("recovers text nodes from standalone text elements", () => {
    const exported = excalidrawConverter.exportDesign(SAMPLE_DESIGN).content as string;
    const imported = excalidrawConverter.importDesign!(exported);
    const textNodes = imported.nodes.filter((n) => n.type === "text");
    expect(textNodes.length).toBe(1);
  });

  it("recovers edges from arrows with bindings", () => {
    const exported = excalidrawConverter.exportDesign(SAMPLE_DESIGN).content as string;
    const imported = excalidrawConverter.importDesign!(exported);
    expect(imported.edges.length).toBe(1);
    expect(imported.edges[0].source).toBe("svc");
    expect(imported.edges[0].target).toBe("db");
  });

  it("guesses component type from label keywords", () => {
    const excalidraw = JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "r1",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 200,
          height: 50,
          strokeColor: "#000",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 1,
          opacity: 100,
          groupIds: [],
          roundness: null,
          seed: 1,
          version: 1,
          versionNonce: 1,
          isDeleted: false,
          boundElements: [{ id: "t1", type: "text" }],
          updated: 1,
          link: null,
          locked: false,
        },
        {
          id: "t1",
          type: "text",
          x: 100,
          y: 25,
          width: 0,
          height: 0,
          strokeColor: "#000",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 1,
          opacity: 100,
          groupIds: [],
          roundness: null,
          seed: 2,
          version: 1,
          versionNonce: 2,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          link: null,
          locked: false,
          text: "Redis Cache",
          fontSize: 14,
          fontFamily: 1,
          textAlign: "center",
          verticalAlign: "middle",
          containerId: "r1",
          originalText: "Redis Cache",
          autoResize: true,
        },
      ],
    });
    const imported = excalidrawConverter.importDesign!(excalidraw);
    const node = imported.nodes.find((n) => n.type === "system");
    expect(node).toBeDefined();
    expect((node!.data as { componentType: string }).componentType).toBe("cache");
  });
});
