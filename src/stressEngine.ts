import type { Node, Edge } from "@xyflow/react";
import type { SystemNodeData, EdgeData, EffectiveStress, NodeStatus, StressConfig } from "./types";

/**
 * Computes effective stress state for every system node based on
 * direct failures, capacity, traffic spikes, edge latency,
 * queue backlog, partitions, and cascading dependencies.
 *
 * Edge direction: source → target means "source depends on target"
 * (source sends requests to target). When target fails, source is affected.
 */
export function computeStressEffects(
  nodes: Node<SystemNodeData>[],
  edges: Edge[],
  config: StressConfig,
): Map<string, EffectiveStress> {
  const result = new Map<string, EffectiveStress>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Phase 1: Direct failures + capacity
  for (const node of nodes) {
    const failure = node.data.stressFailure || "none";
    const capacity = node.data.capacityPercent ?? 100;

    if (failure === "down") {
      result.set(node.id, {
        status: "error",
        reason: "direct",
        explanation: "Node is down",
        effectiveCapacity: 0,
      });
    } else if (failure === "overloaded") {
      result.set(node.id, {
        status: "warning",
        reason: "direct",
        explanation: "Node is overloaded",
        effectiveCapacity: capacity,
      });
    } else if (capacity < 20) {
      result.set(node.id, {
        status: "error",
        reason: "capacity",
        explanation: `Capacity critical: ${capacity}%`,
        effectiveCapacity: capacity,
      });
    } else if (capacity < 50) {
      result.set(node.id, {
        status: "warning",
        reason: "capacity",
        explanation: `Capacity degraded: ${capacity}%`,
        effectiveCapacity: capacity,
      });
    } else {
      result.set(node.id, {
        status: "healthy",
        reason: "healthy",
        explanation: "",
        effectiveCapacity: capacity,
      });
    }
  }

  // Phase 2: Traffic spike
  if (config.trafficMultiplier > 1) {
    for (const node of nodes) {
      const current = result.get(node.id);
      if (!current || current.reason === "direct") continue;

      const capacity = node.data.capacityPercent ?? 100;
      const effective = capacity / config.trafficMultiplier;

      if (effective < 20) {
        applyIfWorse(result, node.id, {
          status: "error",
          reason: "traffic-spike",
          explanation: `Overwhelmed: ${config.trafficMultiplier}x traffic on ${Math.round(capacity)}% capacity`,
          effectiveCapacity: Math.round(effective),
        });
      } else if (effective < 50) {
        applyIfWorse(result, node.id, {
          status: "warning",
          reason: "traffic-spike",
          explanation: `Strained: ${config.trafficMultiplier}x traffic on ${Math.round(capacity)}% capacity`,
          effectiveCapacity: Math.round(effective),
        });
      } else {
        // Update effectiveCapacity even if status doesn't change
        const cur = result.get(node.id)!;
        cur.effectiveCapacity = Math.round(effective);
      }
    }
  }

  // Phase 3: Edge partitions
  for (const edge of edges) {
    const edgeData = edge.data as EdgeData | undefined;
    if (!edgeData?.partitioned) continue;

    for (const nodeId of [edge.source, edge.target]) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      const current = result.get(nodeId);
      if (current && current.reason === "direct") continue;

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
        applyIfWorse(result, nodeId, {
          status: "warning",
          reason: "partition-ap",
          explanation: `Degraded: serving stale data, partition with ${otherLabel}`,
        });
      }
    }
  }

  // Phase 4: Slow edge degradation
  for (const edge of edges) {
    const edgeData = edge.data as EdgeData | undefined;
    if (!edgeData || edgeData.partitioned) continue;
    if (!edgeData.simulatedLatency || edgeData.simulatedLatency <= config.latencyThreshold)
      continue;

    const sourceNode = nodeMap.get(edge.source);
    if (!sourceNode) continue;
    const current = result.get(edge.source);
    if (current && current.reason === "direct") continue;

    const targetLabel = nodeMap.get(edge.target)?.data.label ?? edge.target;
    const latency = edgeData.simulatedLatency;

    if (latency > config.latencyThreshold * 3) {
      applyIfWorse(result, edge.source, {
        status: "error",
        reason: "slow-edge",
        explanation: `Timeout: ${latency}ms latency to ${targetLabel}`,
      });
    } else {
      applyIfWorse(result, edge.source, {
        status: "warning",
        reason: "slow-edge",
        explanation: `Slow dependency: ${latency}ms latency to ${targetLabel}`,
      });
    }
  }

  // Phase 5: Queue backlog (message-queue and stream-processor nodes)
  for (const node of nodes) {
    const ct = node.data.componentType;
    if (ct !== "message-queue" && ct !== "stream-processor") continue;

    const current = result.get(node.id);
    if (current && current.reason === "direct" && current.status === "error") continue;

    // Sum producer rate from upstream nodes
    let producerRate = 0;
    const upstreamEdges: Edge[] = [];
    for (const edge of edges) {
      if (edge.target === node.id) {
        upstreamEdges.push(edge);
        const sourceNode = nodeMap.get(edge.source);
        if (sourceNode) {
          producerRate += (sourceNode.data.metrics.requestsPerSec || 0) * config.trafficMultiplier;
        }
      }
    }

    if (producerRate === 0) continue;

    const consumerRate = node.data.consumerRate ?? 1000;
    if (producerRate <= consumerRate) continue;

    const ratio = producerRate / consumerRate;
    const depth = Math.round((producerRate - consumerRate) * 60);

    if (ratio > 3) {
      applyIfWorse(result, node.id, {
        status: "error",
        reason: "backpressure",
        explanation: `Queue overflow: ${Math.round(producerRate)} msg/s in, ${consumerRate} msg/s out`,
        queueDepth: depth,
      });
    } else {
      applyIfWorse(result, node.id, {
        status: "warning",
        reason: "backpressure",
        explanation: `Queue backing up: ${Math.round(producerRate)} msg/s in, ${consumerRate} msg/s out`,
        queueDepth: depth,
      });
    }

    // Propagate backpressure to upstream sources
    for (const edge of upstreamEdges) {
      const srcCurrent = result.get(edge.source);
      if (srcCurrent && srcCurrent.reason === "direct") continue;

      applyIfWorse(result, edge.source, {
        status: "warning",
        reason: "backpressure",
        explanation: `Backpressure from ${node.data.label}: queue depth ~${depth}`,
      });
    }
  }

  // Phase 6: Cascade from failed nodes (BFS, max depth 3)
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

      for (const edge of edges) {
        if (edge.target !== failedId) continue;
        const dependentId = edge.source;
        const current = result.get(dependentId);
        if (!current) continue;
        if (current.reason === "direct") continue;

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
