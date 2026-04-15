import type { Node, Edge } from "@xyflow/react";
import type { SystemNodeData, ContainerNodeData } from "../types";
import type { ComponentType } from "../types";
import { ulid } from "ulid";
import { randomMetrics } from "../data";
import { BUILTIN_PATTERNS } from "./builtin-patterns";

export interface PatternAnchor {
  id: string;
  componentType: ComponentType;
  position: { x: number; y: number };
}

const CONTAINER_PADDING = 40;
const CONTAINER_HEADER = 36;
const NODE_W = 180;
const NODE_H = 50;

export function instantiatePattern(
  patternId: string,
  dropPosition: { x: number; y: number },
  generateLabel: (type: ComponentType) => string,
  anchor?: PatternAnchor,
): { nodes: Node[]; edges: Edge[] } {
  const pattern = BUILTIN_PATTERNS.find((p) => p.id === patternId);
  if (!pattern) return { nodes: [], edges: [] };

  // Find the pattern node that matches the anchor's component type
  const anchorMatch = anchor
    ? pattern.nodes.find((pn) => pn.componentType === anchor.componentType)
    : undefined;

  // When anchoring, don't wrap in a container (we're extending an existing node)
  if (anchorMatch) {
    return instantiateFlat(pattern, dropPosition, generateLabel, anchor!, anchorMatch);
  }

  // Wrap in a container
  return instantiateInContainer(pattern, dropPosition, generateLabel);
}

function instantiateFlat(
  pattern: (typeof BUILTIN_PATTERNS)[number],
  _dropPosition: { x: number; y: number },
  generateLabel: (type: ComponentType) => string,
  anchor: PatternAnchor,
  anchorMatch: (typeof BUILTIN_PATTERNS)[number]["nodes"][number],
): { nodes: Node[]; edges: Edge[] } {
  const origin = {
    x: anchor.position.x + NODE_W / 2 - anchorMatch.relativePosition.x,
    y: anchor.position.y + NODE_H / 2 - anchorMatch.relativePosition.y,
  };

  const idMap = new Map<string, string>();
  for (const pn of pattern.nodes) {
    if (pn.localId === anchorMatch.localId) {
      idMap.set(pn.localId, anchor.id);
    } else {
      idMap.set(pn.localId, ulid());
    }
  }

  const nodes: Node[] = pattern.nodes
    .filter((pn) => pn.localId !== anchorMatch.localId)
    .map((pn) => ({
      id: idMap.get(pn.localId)!,
      type: "system" as const,
      position: {
        x: origin.x + pn.relativePosition.x - NODE_W / 2,
        y: origin.y + pn.relativePosition.y - NODE_H / 2,
      },
      data: makeNodeData(pn.componentType, generateLabel),
    }));

  const edges = makeEdges(pattern, idMap);
  return { nodes, edges };
}

function instantiateInContainer(
  pattern: (typeof BUILTIN_PATTERNS)[number],
  dropPosition: { x: number; y: number },
  generateLabel: (type: ComponentType) => string,
): { nodes: Node[]; edges: Edge[] } {
  // Compute bounding box of pattern nodes
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pn of pattern.nodes) {
    const left = pn.relativePosition.x - NODE_W / 2;
    const top = pn.relativePosition.y - NODE_H / 2;
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + NODE_W);
    maxY = Math.max(maxY, top + NODE_H);
  }

  const containerW = maxX - minX + CONTAINER_PADDING * 2;
  const containerH = maxY - minY + CONTAINER_PADDING * 2 + CONTAINER_HEADER;

  const containerId = ulid();
  const containerNode: Node = {
    id: containerId,
    type: "container",
    position: {
      x: dropPosition.x - containerW / 2,
      y: dropPosition.y - containerH / 2,
    },
    style: { width: containerW, height: containerH },
    data: {
      label: pattern.name,
      color: pattern.color + "10", // add low alpha to the pattern color
    } satisfies ContainerNodeData,
  };

  const idMap = new Map<string, string>();
  for (const pn of pattern.nodes) {
    idMap.set(pn.localId, ulid());
  }

  // Child positions are relative to the container
  const childNodes: Node[] = pattern.nodes.map((pn) => ({
    id: idMap.get(pn.localId)!,
    type: "system" as const,
    position: {
      x: pn.relativePosition.x - minX + CONTAINER_PADDING - NODE_W / 2,
      y: pn.relativePosition.y - minY + CONTAINER_PADDING + CONTAINER_HEADER - NODE_H / 2,
    },
    parentId: containerId,
    extent: "parent" as const,
    expandParent: true,
    data: makeNodeData(pn.componentType, generateLabel),
  }));

  const edges = makeEdges(pattern, idMap);

  // Container must precede children in the array
  return { nodes: [containerNode, ...childNodes], edges };
}

function makeNodeData(componentType: ComponentType, generateLabel: (type: ComponentType) => string): SystemNodeData {
  return {
    label: generateLabel(componentType),
    componentType,
    status: "healthy",
    metrics: randomMetrics(),
    plan: {},
    sharded: false,
    shardKey: "",
    endpoints: [],
    capClassification: "",
    stressFailure: "none",
    capacityPercent: 100,
    consumerRate: 1000,
  };
}

function makeEdges(
  pattern: (typeof BUILTIN_PATTERNS)[number],
  idMap: Map<string, string>,
): Edge[] {
  return pattern.edges.map((pe) => ({
    id: ulid(),
    source: idMap.get(pe.sourceLocalId)!,
    target: idMap.get(pe.targetLocalId)!,
    type: "labeled" as const,
    data: {
      label: pe.label ?? "",
      protocol: pe.protocol ?? "",
      format: pe.format ?? "",
      partitioned: false,
      simulatedLatency: 0,
    },
  }));
}
