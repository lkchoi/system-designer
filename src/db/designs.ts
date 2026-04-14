import type { Node, Edge, Viewport } from "@xyflow/react";
import { getDB, schedulePersist } from "./database";
import type { SavedFlow } from "../types";
import { ulid } from "ulid";

export interface Design {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesignState {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  flowPaths: SavedFlow[];
}

export function listDesigns(): Design[] {
  const db = getDB();
  const results = db.exec(
    "SELECT id, name, created_at, updated_at FROM designs ORDER BY updated_at DESC",
  );
  if (results.length === 0) return [];
  return results[0].values.map(([id, name, createdAt, updatedAt]) => ({
    id: id as string,
    name: name as string,
    createdAt: createdAt as string,
    updatedAt: updatedAt as string,
  }));
}

export function getDesign(id: string): Design | undefined {
  const db = getDB();
  const results = db.exec("SELECT id, name, created_at, updated_at FROM designs WHERE id = ?", [
    id,
  ]);
  if (results.length === 0 || results[0].values.length === 0) return undefined;
  const [did, name, createdAt, updatedAt] = results[0].values[0];
  return {
    id: did as string,
    name: name as string,
    createdAt: createdAt as string,
    updatedAt: updatedAt as string,
  };
}

export function createDesign(name: string): Design {
  const db = getDB();
  const id = ulid();
  const now = new Date().toISOString();
  db.run("INSERT INTO designs (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [
    id,
    name,
    now,
    now,
  ]);
  db.run("INSERT INTO design_state (design_id) VALUES (?)", [id]);
  schedulePersist();
  return { id, name, createdAt: now, updatedAt: now };
}

export function renameDesign(id: string, name: string): void {
  const db = getDB();
  db.run("UPDATE designs SET name = ?, updated_at = ? WHERE id = ?", [
    name,
    new Date().toISOString(),
    id,
  ]);
  schedulePersist();
}

export function deleteDesign(id: string): void {
  const db = getDB();
  db.run("DELETE FROM flow_paths WHERE design_id = ?", [id]);
  db.run("DELETE FROM design_state WHERE design_id = ?", [id]);
  db.run("DELETE FROM designs WHERE id = ?", [id]);
  schedulePersist();
}

export function loadDesignState(designId: string): DesignState {
  const db = getDB();

  const stateResults = db.exec(
    "SELECT nodes, edges, viewport FROM design_state WHERE design_id = ?",
    [designId],
  );
  let nodes: Node[] = [];
  let edges: Edge[] = [];
  let viewport: Viewport = { x: 0, y: 0, zoom: 1 };

  if (stateResults.length > 0 && stateResults[0].values.length > 0) {
    const [nodesJson, edgesJson, viewportJson] = stateResults[0].values[0];
    nodes = JSON.parse(nodesJson as string);
    edges = JSON.parse(edgesJson as string);
    viewport = JSON.parse(viewportJson as string);
  }

  const flowResults = db.exec(
    "SELECT id, name, description, steps FROM flow_paths WHERE design_id = ? ORDER BY created_at",
    [designId],
  );
  const flowPaths: SavedFlow[] =
    flowResults.length > 0
      ? flowResults[0].values.map(([id, name, desc, steps]) => ({
          id: id as string,
          name: name as string,
          description: desc as string,
          steps: JSON.parse(steps as string),
        }))
      : [];

  return { nodes, edges, viewport, flowPaths };
}

export function saveDesignState(
  designId: string,
  nodes: Node[],
  edges: Edge[],
  viewport: Viewport,
): void {
  const db = getDB();
  db.run("UPDATE design_state SET nodes = ?, edges = ?, viewport = ? WHERE design_id = ?", [
    JSON.stringify(nodes),
    JSON.stringify(edges),
    JSON.stringify(viewport),
    designId,
  ]);
  db.run("UPDATE designs SET updated_at = ? WHERE id = ?", [new Date().toISOString(), designId]);
  schedulePersist();
}

export function saveFlowPath(designId: string, flow: SavedFlow): void {
  const db = getDB();
  db.run(
    "INSERT OR REPLACE INTO flow_paths (id, design_id, name, description, steps, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [
      flow.id,
      designId,
      flow.name,
      flow.description,
      JSON.stringify(flow.steps),
      new Date().toISOString(),
    ],
  );
  schedulePersist();
}

export function deleteFlowPath(id: string): void {
  const db = getDB();
  db.run("DELETE FROM flow_paths WHERE id = ?", [id]);
  schedulePersist();
}
