import { useState, useMemo } from "react";
import { computeReplication, CONSISTENCY_LEVELS } from "./replication";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ReplicationPlanner({ open, onClose }: Props) {
  const [nodeCount, setNodeCount] = useState("5");
  const [rf, setRf] = useState("3");
  const [consistency, setConsistency] = useState<"one" | "quorum" | "all">("quorum");

  const result = useMemo(() => {
    const n = parseInt(nodeCount) || 0;
    const r = parseInt(rf) || 0;
    if (n <= 0 || r <= 0) return null;
    return computeReplication({
      nodeCount: n,
      replicationFactor: r,
      consistencyLevel: consistency,
    });
  }, [nodeCount, rf, consistency]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl w-[480px] max-w-[90vw] max-h-[85vh] flex flex-col shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="flex items-center justify-between px-6 pt-5 shrink-0">
          <span className="text-base font-bold text-text-bright">Replication Planner</span>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-2 hover:text-text-bright"
            onClick={onClose}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 pt-5 pb-6 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-3.5">
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Cluster nodes</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="1"
                value={nodeCount}
                onChange={(e) => setNodeCount(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Replication factor</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="1"
                value={rf}
                onChange={(e) => setRf(e.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5 mt-4">
            <span className="text-xs font-medium text-text-dim">Consistency level</span>
            <div className="flex gap-0.5 bg-surface-2 rounded-lg p-0.5">
              {CONSISTENCY_LEVELS.map((cl) => (
                <button
                  key={cl.id}
                  className={`flex-1 text-xs font-medium text-text-dim px-3 py-[5px] rounded-md transition-all duration-150 hover:text-text${consistency === cl.id ? " text-white bg-accent" : ""}`}
                  onClick={() => setConsistency(cl.id)}
                  title={cl.description}
                >
                  {cl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-border my-5" />

          {result ? (
            <div className="flex flex-col gap-[18px]">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium ${result.stronglyConsistent ? "text-[#22c55e] bg-[rgba(34,197,94,0.08)]" : "text-[#eab308] bg-[rgba(234,179,8,0.08)]"}`}
              >
                {result.stronglyConsistent
                  ? "Strongly consistent (R + W > RF)"
                  : "Eventually consistent (R + W ≤ RF)"}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
                  Quorum
                </span>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Read quorum</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {result.readQuorum} of {Math.min(parseInt(rf), parseInt(nodeCount))}
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Write quorum</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {result.writeQuorum} of {Math.min(parseInt(rf), parseInt(nodeCount))}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
                  Fault Tolerance
                </span>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Tolerated read failures</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {result.toleratedReadFailures}
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Tolerated write failures</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {result.toleratedWriteFailures}
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Read availability</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {result.readAvailability.toFixed(6)}%
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Write availability</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {result.writeAvailability.toFixed(6)}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center px-4 py-8 text-text-dim text-[13px]">
              Enter cluster configuration to see quorum analysis
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
