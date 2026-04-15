import type { Node, Edge } from "@xyflow/react";
import type { SystemNodeData } from "../types";
import type { ComponentType } from "../types";
import { ulid } from "ulid";
import { randomMetrics } from "../data";
import { BUILTIN_PATTERNS } from "./builtin-patterns";

export interface PatternAnchor {
  id: string;
  componentType: ComponentType;
  position: { x: number; y: number };
}

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

  // If we have an anchor match, position all nodes relative to the anchor node
  // instead of relative to the drop position
  const w = 180;
  const h = 50;
  const origin = anchorMatch
    ? {
        x: anchor!.position.x + w / 2 - anchorMatch.relativePosition.x,
        y: anchor!.position.y + h / 2 - anchorMatch.relativePosition.y,
      }
    : dropPosition;

  // Build localId -> real ID mapping
  const idMap = new Map<string, string>();
  for (const pn of pattern.nodes) {
    if (anchorMatch && pn.localId === anchorMatch.localId) {
      idMap.set(pn.localId, anchor!.id);
    } else {
      idMap.set(pn.localId, ulid());
    }
  }

  // Create new nodes (skip the anchor node — it already exists)
  const nodes: Node[] = pattern.nodes
    .filter((pn) => !(anchorMatch && pn.localId === anchorMatch.localId))
    .map((pn) => ({
      id: idMap.get(pn.localId)!,
      type: "system" as const,
      position: {
        x: origin.x + pn.relativePosition.x - w / 2,
        y: origin.y + pn.relativePosition.y - h / 2,
      },
      data: {
        label: generateLabel(pn.componentType),
        componentType: pn.componentType,
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
      } satisfies SystemNodeData,
    }));

  const edges: Edge[] = pattern.edges.map((pe) => ({
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

  return { nodes, edges };
}
