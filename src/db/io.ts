import type { Node, Edge, Viewport } from "@xyflow/react";
import type { SavedFlow } from "../types";
import { ulid } from "ulid";
import { getDesign, createDesign, saveDesignState, loadDesignState, saveFlowPath } from "./designs";

export interface DesignJSON {
  version: number;
  name: string;
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  flowPaths: SavedFlow[];
}

export function exportDesign(designId: string): string {
  const design = getDesign(designId);
  if (!design) throw new Error(`Design not found: ${designId}`);
  const state = loadDesignState(designId);
  const json: DesignJSON = {
    version: 1,
    name: design.name,
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport,
    flowPaths: state.flowPaths,
  };
  return JSON.stringify(json, null, 2);
}

export function parseDesignJSON(json: string): DesignJSON {
  const parsed = JSON.parse(json);
  if (typeof parsed.version !== "number") throw new Error("Missing version field");
  if (!Array.isArray(parsed.nodes)) throw new Error("Missing or invalid nodes");
  if (!Array.isArray(parsed.edges)) throw new Error("Missing or invalid edges");
  return {
    version: parsed.version,
    name: typeof parsed.name === "string" && parsed.name ? parsed.name : "Imported Design",
    nodes: parsed.nodes,
    edges: parsed.edges,
    viewport: parsed.viewport ?? { x: 0, y: 0, zoom: 1 },
    flowPaths: Array.isArray(parsed.flowPaths) ? parsed.flowPaths : [],
  };
}

export function importDesign(json: string): { id: string; name: string } {
  const { name, nodes, edges, viewport, flowPaths } = parseDesignJSON(json);
  const design = createDesign(name);
  saveDesignState(design.id, nodes, edges, viewport);
  for (const flow of flowPaths) {
    saveFlowPath(design.id, { ...flow, id: ulid() });
  }
  return { id: design.id, name: design.name };
}

export function downloadJSON(content: string, filename: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function pickAndReadFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error("No file selected"));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}
