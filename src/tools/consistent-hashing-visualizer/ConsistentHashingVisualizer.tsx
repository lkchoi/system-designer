import { useState, useMemo } from "react";
import {
  buildRing,
  computeRedistribution,
  generateKeys,
  NODE_COLORS,
  type RingNode,
} from "./hashing";

interface Props {
  open: boolean;
  onClose: () => void;
}

const RING_CX = 160;
const RING_CY = 160;
const RING_R = 130;

function posToXY(position: number, r = RING_R) {
  const angle = position * Math.PI * 2 - Math.PI / 2;
  return { x: RING_CX + Math.cos(angle) * r, y: RING_CY + Math.sin(angle) * r };
}

export default function ConsistentHashingVisualizer({ open, onClose }: Props) {
  const [nodeCount, setNodeCount] = useState(3);
  const [vnodeCount, setVnodeCount] = useState(50);
  const [keyCount, setKeyCount] = useState(1000);
  const [pendingAction, setPendingAction] = useState<"add" | "remove" | null>(null);

  const nodes: RingNode[] = useMemo(
    () =>
      Array.from({ length: nodeCount }, (_, i) => ({
        id: `node-${i}`,
        label: `Node ${i + 1}`,
        color: NODE_COLORS[i % NODE_COLORS.length],
      })),
    [nodeCount],
  );

  const keys = useMemo(() => generateKeys(keyCount), [keyCount]);
  const ring = useMemo(() => buildRing(nodes, vnodeCount, keys), [nodes, vnodeCount, keys]);

  const redistribution = useMemo(() => {
    if (!pendingAction) return null;
    let nextNodes: RingNode[];
    if (pendingAction === "add") {
      nextNodes = [
        ...nodes,
        {
          id: `node-${nodeCount}`,
          label: `Node ${nodeCount + 1}`,
          color: NODE_COLORS[nodeCount % NODE_COLORS.length],
        },
      ];
    } else {
      nextNodes = nodes.slice(0, -1);
    }
    if (nextNodes.length === 0) return null;
    const nextRing = buildRing(nextNodes, vnodeCount, keys);
    return computeRedistribution(ring, nextRing);
  }, [pendingAction, nodes, nodeCount, vnodeCount, keys, ring]);

  const nodeColorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) m.set(n.id, n.color);
    return m;
  }, [nodes]);

  if (!open) return null;

  // Show a subset of vnodes on the ring to avoid clutter
  const maxRingDots = 60;
  const visibleVnodes = ring.vnodes.length <= maxRingDots
    ? ring.vnodes
    : ring.vnodes.filter((_, i) => i % Math.ceil(ring.vnodes.length / maxRingDots) === 0);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl w-[640px] max-w-[92vw] max-h-[85vh] flex flex-col shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="flex items-center justify-between px-6 pt-5 shrink-0">
          <span className="text-base font-bold text-text-bright">
            Consistent Hashing Visualizer
          </span>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-2 hover:text-text-bright"
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pt-4 pb-6 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Nodes</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="1"
                max="8"
                value={nodeCount}
                onChange={(e) => {
                  setNodeCount(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)));
                  setPendingAction(null);
                }}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Virtual nodes each</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="1"
                max="500"
                value={vnodeCount}
                onChange={(e) => {
                  setVnodeCount(Math.max(1, parseInt(e.target.value) || 1));
                  setPendingAction(null);
                }}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Keys</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="1"
                max="10000"
                value={keyCount}
                onChange={(e) => {
                  setKeyCount(Math.max(1, parseInt(e.target.value) || 1));
                  setPendingAction(null);
                }}
              />
            </label>
          </div>

          {/* Ring visualization */}
          <div className="flex gap-5 items-start">
            <svg
              width="320"
              height="320"
              viewBox="0 0 320 320"
              className="shrink-0 bg-surface-2 rounded-xl border border-border"
            >
              {/* Ring circle */}
              <circle
                cx={RING_CX}
                cy={RING_CY}
                r={RING_R}
                fill="none"
                stroke="var(--border)"
                strokeWidth="2"
              />
              {/* Virtual nodes as dots on the ring */}
              {visibleVnodes.map((vn, i) => {
                const { x, y } = posToXY(vn.position);
                return (
                  <circle
                    key={`vn-${i}`}
                    cx={x}
                    cy={y}
                    r={3}
                    fill={nodeColorMap.get(vn.nodeId) ?? "#888"}
                    opacity={0.7}
                  />
                );
              })}
              {/* Arcs showing ownership ranges — color the ring segments */}
              {ring.vnodes.length > 0 &&
                ring.vnodes.map((vn, i) => {
                  const next = ring.vnodes[(i + 1) % ring.vnodes.length];
                  const startAngle = vn.position * 360 - 90;
                  const endAngle = next.position * 360 - 90;
                  const sweep = i === ring.vnodes.length - 1
                    ? 360 - (vn.position - next.position) * 360
                    : (next.position - vn.position) * 360;
                  if (sweep <= 0 || sweep > 359) return null;
                  const r = RING_R + 8;
                  const startRad = (startAngle * Math.PI) / 180;
                  const endRad = ((startAngle + sweep) * Math.PI) / 180;
                  const x1 = RING_CX + Math.cos(startRad) * r;
                  const y1 = RING_CY + Math.sin(startRad) * r;
                  const x2 = RING_CX + Math.cos(endRad) * r;
                  const y2 = RING_CY + Math.sin(endRad) * r;
                  const largeArc = sweep > 180 ? 1 : 0;
                  return (
                    <path
                      key={`arc-${i}`}
                      d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
                      fill="none"
                      stroke={nodeColorMap.get(next.nodeId) ?? "#888"}
                      strokeWidth="3"
                      opacity={0.25}
                    />
                  );
                })}
              {/* Center label */}
              <text
                x={RING_CX}
                y={RING_CY - 8}
                textAnchor="middle"
                fill="var(--text-dim)"
                fontSize="11"
              >
                {ring.vnodes.length} vnodes
              </text>
              <text
                x={RING_CX}
                y={RING_CY + 8}
                textAnchor="middle"
                fill="var(--text-bright)"
                fontSize="13"
                fontWeight="600"
              >
                {keyCount.toLocaleString()} keys
              </text>
            </svg>

            <div className="flex-1 min-w-0 flex flex-col gap-4">
              {/* Distribution */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
                  Distribution
                </span>
                {nodes.map((node) => {
                  const count = ring.distribution.get(node.id) ?? 0;
                  const pct = keyCount > 0 ? (count / keyCount) * 100 : 0;
                  const ideal = 100 / nodeCount;
                  return (
                    <div key={node.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: node.color }}
                          />
                          <span className="text-[13px] text-text">{node.label}</span>
                        </div>
                        <span className="font-mono text-[12px] text-text-bright">
                          {count} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (pct / ideal) * 50)}%`,
                            backgroundColor: node.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-text-dim">Std deviation</span>
                  <span className="font-mono text-[12px] text-text-bright">
                    {ring.standardDeviation.toFixed(1)} keys
                  </span>
                </div>
              </div>

              {/* Redistribution preview */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                  Redistribution preview
                </span>
                <div className="flex gap-1.5">
                  <button
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${pendingAction === "add" ? "bg-accent text-white" : "bg-surface-2 text-text-dim border border-border hover:text-text-bright"}`}
                    onClick={() => setPendingAction(pendingAction === "add" ? null : "add")}
                    disabled={nodeCount >= 8}
                  >
                    + Add node
                  </button>
                  <button
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${pendingAction === "remove" ? "bg-accent text-white" : "bg-surface-2 text-text-dim border border-border hover:text-text-bright"}`}
                    onClick={() =>
                      setPendingAction(pendingAction === "remove" ? null : "remove")
                    }
                    disabled={nodeCount <= 1}
                  >
                    - Remove node
                  </button>
                </div>
                {redistribution && (
                  <div className="bg-surface-2 rounded-lg px-3 py-2 mt-1">
                    <div className="flex items-center justify-between py-[2px]">
                      <span className="text-[12px] text-text">Keys moved</span>
                      <span className="font-mono text-[12px] font-semibold text-text-bright">
                        {redistribution.moved.toLocaleString()} / {redistribution.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-[2px]">
                      <span className="text-[12px] text-text">Redistribution</span>
                      <span className="font-mono text-[12px] font-semibold text-text-bright">
                        {redistribution.percent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-[11px] text-text-dim mt-1">
                      Ideal: {(100 / (pendingAction === "add" ? nodeCount + 1 : nodeCount - 1)).toFixed(1)}%
                      (K/N = {Math.round(keyCount / (pendingAction === "add" ? nodeCount + 1 : nodeCount - 1))} keys)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
