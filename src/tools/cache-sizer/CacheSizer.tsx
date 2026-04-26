import { useState, useMemo } from "react";
import { computeCache, formatMemory, COMMON_OBJECT_SIZES } from "./cache";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CacheSizer({ open, onClose }: Props) {
  const [objectCount, setObjectCount] = useState("1000000");
  const [avgSize, setAvgSize] = useState("1024");
  const [ttl, setTtl] = useState("3600");
  const [hitRate, setHitRate] = useState("95");
  const [writeRate, setWriteRate] = useState("1000");
  const [overhead, setOverhead] = useState("20");

  const result = useMemo(() => {
    const count = parseFloat(objectCount) || 0;
    const size = parseFloat(avgSize) || 0;
    if (count <= 0 || size <= 0) return null;
    return computeCache({
      objectCount: count,
      avgObjectSizeBytes: size,
      ttlSeconds: parseFloat(ttl) || 0,
      hitRate: parseFloat(hitRate) || 0,
      writeRate: parseFloat(writeRate) || 0,
      overheadPercent: parseFloat(overhead) || 0,
    });
  }, [objectCount, avgSize, ttl, hitRate, writeRate, overhead]);

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
          <span className="text-base font-bold text-text-bright">Cache Sizer</span>
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
              <span className="text-xs font-medium text-text-dim">Object count</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="0"
                value={objectCount}
                onChange={(e) => setObjectCount(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Avg object size (bytes)</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="0"
                value={avgSize}
                onChange={(e) => setAvgSize(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">TTL (seconds)</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="0"
                value={ttl}
                onChange={(e) => setTtl(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Hit rate (%)</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={hitRate}
                onChange={(e) => setHitRate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Request rate (req/s)</span>
              <input
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="0"
                value={writeRate}
                onChange={(e) => setWriteRate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Overhead (%)</span>
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
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
                  Memory
                </span>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Raw data</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {formatMemory(result.rawMemoryMB)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">With overhead ({overhead}%)</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {formatMemory(result.withOverheadMB)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
                  Throughput
                </span>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Miss rate</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {result.missRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Origin reads/sec</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {result.readsFromOriginPerSec.toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-[3px]">
                  <span className="text-[13px] text-text">Evictions/sec (TTL)</span>
                  <span className="font-mono text-sm font-semibold text-text-bright">
                    {result.evictionsPerSec.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center px-4 py-8 text-text-dim text-[13px]">
              Enter object count and size to see estimates
            </div>
          )}

          <div className="h-px bg-border my-4" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
              Common object sizes
            </span>
            {COMMON_OBJECT_SIZES.map((s) => (
              <button
                key={s.label}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors duration-100 text-left hover:bg-surface-2"
                onClick={() => setAvgSize(String(s.bytes))}
              >
                <span className="text-[13px] text-text">{s.label}</span>
                <span className="font-mono text-[13px] font-semibold text-text-bright">
                  {s.bytes >= 1024 ? `${(s.bytes / 1024).toFixed(0)} KB` : `${s.bytes} B`}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
