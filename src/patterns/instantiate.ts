import type { Node, Edge } from "@xyflow/react";
import type { SystemNodeData } from "../types";
import type { ComponentType } from "../types";
import { ulid } from "ulid";
import { randomMetrics } from "../data";
import { BUILTIN_PATTERNS } from "./builtin-patterns";

export function instantiatePattern(
  patternId: string,
  dropPosition: { x: number; y: number },
  generateLabel: (type: ComponentType) => string,
): { nodes: Node[]; edges: Edge[] } {
  const pattern = BUILTIN_PATTERNS.find((p) => p.id === patternId);
  if (!pattern) return { nodes: [], edges: [] };

  const idMap = new Map<string, string>();
  for (const pn of pattern.nodes) {
    idMap.set(pn.localId, ulid());
  }

  const w = 180;
  const h = 50;

  const nodes: Node[] = pattern.nodes.map((pn) => ({
    id: idMap.get(pn.localId)!,
    type: "system" as const,
    position: {
      x: dropPosition.x + pn.relativePosition.x - w / 2,
      y: dropPosition.y + pn.relativePosition.y - h / 2,
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
