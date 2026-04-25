/** Simple deterministic hash — FNV-1a 32-bit. */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

export interface RingNode {
  id: string;
  label: string;
  color: string;
}

export interface VirtualNode {
  position: number; // 0–1 on the ring
  nodeId: string;
  vnodeIndex: number;
}

export interface KeyPlacement {
  key: string;
  position: number; // 0–1 on the ring
  assignedTo: string; // node id
}

export interface RingState {
  vnodes: VirtualNode[];
  keys: KeyPlacement[];
  distribution: Map<string, number>; // nodeId → key count
  standardDeviation: number;
}

const RING_MAX = 0xffffffff;

export function hashToRing(input: string): number {
  return fnv1a(input) / RING_MAX;
}

export function buildRing(nodes: RingNode[], vnodeCount: number, keys: string[]): RingState {
  // Place virtual nodes
  const vnodes: VirtualNode[] = [];
  for (const node of nodes) {
    for (let i = 0; i < vnodeCount; i++) {
      const position = hashToRing(`${node.id}:vnode:${i}`);
      vnodes.push({ position, nodeId: node.id, vnodeIndex: i });
    }
  }
  vnodes.sort((a, b) => a.position - b.position);

  // Place keys — each key goes to the first vnode clockwise from its position
  const distribution = new Map<string, number>();
  for (const node of nodes) distribution.set(node.id, 0);

  const placements: KeyPlacement[] = keys.map((key) => {
    const position = hashToRing(`key:${key}`);
    const assignedTo = findNode(vnodes, position);
    distribution.set(assignedTo, (distribution.get(assignedTo) ?? 0) + 1);
    return { key, position, assignedTo };
  });

  // Compute standard deviation of distribution
  const counts = [...distribution.values()];
  const mean = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  const variance =
    counts.length > 0
      ? counts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / counts.length
      : 0;
  const standardDeviation = Math.sqrt(variance);

  return { vnodes, keys: placements, distribution, standardDeviation };
}

/** Find the node responsible for a position by walking clockwise. */
function findNode(sortedVnodes: VirtualNode[], position: number): string {
  if (sortedVnodes.length === 0) return "";
  for (const vn of sortedVnodes) {
    if (vn.position >= position) return vn.nodeId;
  }
  // Wrap around — first vnode on the ring
  return sortedVnodes[0].nodeId;
}

/**
 * Compute how many keys would move if a node is added or removed.
 * Returns { moved, total, percent }.
 */
export function computeRedistribution(
  before: RingState,
  after: RingState,
): { moved: number; total: number; percent: number } {
  const total = before.keys.length;
  let moved = 0;
  const afterMap = new Map(after.keys.map((k) => [k.key, k.assignedTo]));
  for (const k of before.keys) {
    const afterAssignment = afterMap.get(k.key);
    if (afterAssignment && afterAssignment !== k.assignedTo) moved++;
  }
  return { moved, total, percent: total > 0 ? (moved / total) * 100 : 0 };
}

export const NODE_COLORS = [
  "#6366f1", // indigo
  "#22c55e", // green
  "#f97316", // orange
  "#ec4899", // pink
  "#eab308", // yellow
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#ef4444", // red
];

export function generateKeys(count: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    keys.push(`key-${i}`);
  }
  return keys;
}
