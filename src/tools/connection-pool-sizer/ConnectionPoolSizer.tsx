import { useState, useMemo } from "react";
import { computePool, DB_CONNECTION_LIMITS } from "./pool";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ConnectionPoolSizer({ open, onClose }: Props) {
  const [concurrent, setConcurrent] = useState("100");
  const [queryMs, setQueryMs] = useState("10");
  const [instances, setInstances] = useState("4");
  const [maxConns, setMaxConns] = useState("100");
  const [overhead, setOverhead] = useState("20");

  const result = useMemo(() => {
    const c = parseFloat(concurrent) || 0;
    if (c <= 0) return null;
    return computePool({
      concurrentRequests: c,
      avgQueryMs: parseFloat(queryMs) || 0,
      serviceInstances: parseInt(instances) || 1,
      maxConnectionsPerDb: parseInt(maxConns) || 100,
      overheadPercent: parseFloat(overhead) || 0,
    });
  }, [concurrent, queryMs, instances, maxConns, overhead]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl w-[520px] max-w-[90vw] max-h-[85vh] flex flex-col shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="flex items-center justify-between px-6 pt-5 shrink-0">
          <span className="text-base font-bold text-text-bright">Connection Pool Sizer</span>
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
              <span className="text-xs font-medium text-text-dim">Concurrent requests</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="0"
                value={concurrent}
                onChange={(e) => setConcurrent(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Avg query time (ms)</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="0"
                value={queryMs}
                onChange={(e) => setQueryMs(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Service instances</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="1"
                value={instances}
                onChange={(e) => setInstances(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">DB max connections</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="1"
                value={maxConns}
                onChange={(e) => setMaxConns(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Safety margin (%)</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="0"
                value={overhead}
                onChange={(e) => setOverhead(e.target.value)}
              />
            </label>
          </div>

          <div className="h-px bg-border my-5" />

          {result ? (
            <div className="flex flex-col gap-[18px]">
              {result.saturated && (
                <div className="text-[13px] text-[#ef4444] bg-[rgba(239,68,68,0.08)] rounded-lg px-3.5 py-2.5 font-medium">
                  Warning: {result.totalConnections} connections exceeds DB limit of {maxConns}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
                  Pool Size
                </span>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Per instance</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {result.connectionsPerInstance}
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Total ({instances} instances)</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {result.totalConnections}
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Utilization</span>
                  <span
                    className={`font-mono text-sm font-semibold ${result.utilizationPercent > 80 ? "text-[#ef4444]" : result.utilizationPercent > 60 ? "text-[#eab308]" : "text-[#22c55e]"}`}
                  >
                    {result.utilizationPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Headroom</span>
                  <span
                    className={`font-mono text-sm font-semibold ${result.headroom < 0 ? "text-[#ef4444]" : "text-text-bright"}`}
                  >
                    {result.headroom}
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Max QPS</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {result.maxQps.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center px-4 py-8 text-text-dim text-[13px]">
              Enter request count to see pool sizing
            </div>
          )}

          <div className="h-px bg-border my-4" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
              DB connection limits
            </span>
            {DB_CONNECTION_LIMITS.map((d) => (
              <button
                key={d.name}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors duration-100 text-left hover:bg-surface-2"
                onClick={() => setMaxConns(String(d.maxConnections))}
              >
                <span className="text-[13px] text-text">{d.name}</span>
                <span className="font-mono text-[13px] font-semibold text-text-bright">
                  {d.maxConnections.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
