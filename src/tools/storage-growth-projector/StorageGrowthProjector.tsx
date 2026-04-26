import { useState, useMemo } from "react";
import { projectStorage, formatGB } from "./storage";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function StorageGrowthProjector({ open, onClose }: Props) {
  const [daily, setDaily] = useState("10");
  const [growth, setGrowth] = useState("5");
  const [retention, setRetention] = useState("365");
  const [compression, setCompression] = useState("2");
  const [rf, setRf] = useState("3");

  const result = useMemo(() => {
    const d = parseFloat(daily) || 0;
    if (d <= 0) return null;
    return projectStorage({
      dailyIngestGB: d,
      growthRatePercent: parseFloat(growth) || 0,
      retentionDays: parseInt(retention) || 365,
      compressionRatio: parseFloat(compression) || 1,
      replicationFactor: parseInt(rf) || 1,
    });
  }, [daily, growth, retention, compression, rf]);

  if (!open) return null;

  const milestones = result
    ? [0, 6, 12, 24, 36, 60].map((m) => result.projections[m]).filter(Boolean)
    : [];

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
          <span className="text-base font-bold text-text-bright">Storage Growth Projector</span>
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
              <span className="text-xs font-medium text-text-dim">Daily ingest (GB)</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="0"
                value={daily}
                onChange={(e) => setDaily(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Monthly growth (%)</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="0"
                step="0.5"
                value={growth}
                onChange={(e) => setGrowth(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Retention (days)</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="1"
                value={retention}
                onChange={(e) => setRetention(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Compression ratio</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="1"
                step="0.5"
                value={compression}
                onChange={(e) => setCompression(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Replication factor</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="1"
                max="10"
                value={rf}
                onChange={(e) => setRf(e.target.value)}
              />
            </label>
          </div>
          <div className="h-px bg-border my-5" />
          {result && milestones.length > 0 ? (
            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
                  Projections (with replication)
                </span>
                {milestones.map((p) => (
                  <div key={p.month} className="flex items-center justify-between py-[3px]">
                    <span className="text-[13px] text-text">
                      {p.month === 0 ? "Now" : `${p.month} months`}
                    </span>
                    <span className="font-mono text-sm font-semibold text-text-bright">
                      {formatGB(p.replicatedGB)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
                  Daily Ingest Rate
                </span>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Now</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {formatGB(parseFloat(daily) || 0)}/day
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">After 1 year</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {formatGB(result.dailyIngestAfter1y)}/day
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">After 3 years</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {formatGB(result.dailyIngestAfter3y)}/day
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center px-4 py-8 text-text-dim text-[13px]">
              Enter daily ingest to see projections
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
