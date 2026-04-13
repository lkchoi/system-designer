import type { Node, Edge } from "@xyflow/react";
import type { SystemNodeData, EdgeData, EffectiveStress, NodeStatus } from "./types";

/**
 * Computes effective stress state for every system node based on
 * direct failures, edge partitions, and cascading dependencies.
 *
 * Edge direction: source → target means "source depends on target"
 * (source sends requests to target). When target fails, source is affected.
 */
export function computeStressEffects(
  nodes: Node<SystemNodeData>[],
  edges: Edge[],
): Map<string, EffectiveStress> {
  const result = new Map<string, EffectiveStress>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Phase 1: Direct failures
  for (const node of nodes) {
    const failure = node.data.stressFailure || "none";
    if (failure === "down") {
      result.set(node.id, { status: "error", reason: "direct", explanation: "Node is down" });
    } else if (failure === "overloaded") {
      result.set(node.id, {
        status: "warning",
        reason: "direct",
        explanation: "Node is overloaded",
      });
    } else {
      result.set(node.id, { status: "healthy", reason: "healthy", explanation: "" });
    }
  }

  // Phase 2: Edge partitions
  for (const edge of edges) {
    const edgeData = edge.data as EdgeData | undefined;
    if (!edgeData?.partitioned) continue;

    for (const nodeId of [edge.source, edge.target]) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      const current = result.get(nodeId);
      if (current && current.reason === "direct") continue; // direct failure takes precedence

      const cap = node.data.capClassification || "";
      const otherNodeId = nodeId === edge.source ? edge.target : edge.source;
      const otherLabel = nodeMap.get(otherNodeId)?.data.label ?? otherNodeId;

      if (cap === "CP" || cap === "CA") {
        applyIfWorse(result, nodeId, {
          status: "error",
          reason: "partition-cp",
          explanation: `Unavailable: network partition with ${otherLabel}`,
        });
      } else {
        // AP or unclassified — degrades but stays available
        applyIfWorse(result, nodeId, {
          status: "warning",
          reason: "partition-ap",
          explanation: `Degraded: serving stale data, partition with ${otherLabel}`,
        });
      }
    }
  }

  // Phase 3: Cascade from failed nodes (BFS, max depth 3)
  const visited = new Set<string>();
  let frontier: string[] = [];

  for (const node of nodes) {
    const effect = result.get(node.id);
    if (effect && effect.status === "error") {
      frontier.push(node.id);
    }
  }

  for (let depth = 0; depth < 3 && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const failedId of frontier) {
      if (visited.has(failedId)) continue;
      visited.add(failedId);

      const failedLabel = nodeMap.get(failedId)?.data.label ?? failedId;

      // Find edges where failedId is the TARGET (meaning source depends on it)
      for (const edge of edges) {
        if (edge.target !== failedId) continue;
        const dependentId = edge.source;
        const current = result.get(dependentId);
        if (!current) continue;
        if (current.reason === "direct") continue; // direct failure takes precedence

        const applied = applyIfWorse(result, dependentId, {
          status: "warning",
          reason: "cascade",
          explanation: `Degraded: ${failedLabel} is ${nodeMap.get(failedId)?.data.stressFailure === "down" ? "down" : "unavailable"}`,
        });
        if (applied) {
          next.push(dependentId);
        }
      }
    }
    frontier = next;
  }

  return result;
}

const SEVERITY: Record<NodeStatus, number> = {
  healthy: 0,
  idle: 1,
  warning: 2,
  error: 3,
};

function applyIfWorse(
  map: Map<string, EffectiveStress>,
  nodeId: string,
  effect: EffectiveStress,
): boolean {
  const current = map.get(nodeId);
  if (!current || SEVERITY[effect.status] > SEVERITY[current.status]) {
    map.set(nodeId, effect);
    return true;
  }
  return false;
}
