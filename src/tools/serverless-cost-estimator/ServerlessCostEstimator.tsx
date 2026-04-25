import { useState, useMemo } from "react";
import { computeServerlessCost, formatCost, PROVIDERS } from "./serverless";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ServerlessCostEstimator({ open, onClose }: Props) {
  const [invocations, setInvocations] = useState("1000000");
  const [duration, setDuration] = useState("200");
  const [memory, setMemory] = useState("512");
  const [provider, setProvider] = useState<"aws" | "gcp" | "cloudflare">("aws");

  const result = useMemo(() => {
    const inv = parseFloat(invocations) || 0;
    if (inv <= 0) return null;
    return computeServerlessCost({
      invocationsPerMonth: inv,
      avgDurationMs: parseFloat(duration) || 0,
      memoryMB: parseFloat(memory) || 128,
      provider,
    });
  }, [invocations, duration, memory, provider]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-[520px] max-w-[90vw] max-h-[85vh] flex flex-col shadow-[0_16px_50px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <div className="flex items-center justify-between px-6 pt-5 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-base font-bold text-text-bright">Serverless Cost Estimator</span>
            <div className="flex gap-0.5 bg-surface-2 rounded-lg p-0.5">
              {PROVIDERS.map((p) => (
                <button key={p.id} className={`text-xs font-medium text-text-dim px-3 py-[5px] rounded-md transition-all duration-150 hover:text-text${provider === p.id ? " text-white bg-accent" : ""}`} onClick={() => setProvider(p.id)}>{p.label}</button>
              ))}
            </div>
          </div>
          <button className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-2 hover:text-text-bright" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 pt-5 pb-6 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-3 gap-3.5">
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Invocations/mo</span>
              <input className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent" type="number" min="0" value={invocations} onChange={(e) => setInvocations(e.target.value)} />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Avg duration (ms)</span>
              <input className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent" type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Memory (MB)</span>
              <input className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent" type="number" min="64" step="64" value={memory} onChange={(e) => setMemory(e.target.value)} />
            </label>
          </div>
          <div className="h-px bg-border my-5" />
          {result ? (
            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Monthly Cost</span>
                <span className="text-xl font-bold font-mono text-text-bright">{formatCost(result.totalCost)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">Breakdown</span>
                <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Compute ({result.gbSeconds.toLocaleString(undefined, { maximumFractionDigits: 0 })} GB-s)</span><span className="font-mono text-sm font-semibold text-text-bright">{formatCost(result.computeCost)}</span></div>
                <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Requests</span><span className="font-mono text-sm font-semibold text-text-bright">{formatCost(result.requestCost)}</span></div>
              </div>
              {(result.freeComputeSavings > 0 || result.freeRequestSavings > 0) && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">Free Tier Savings</span>
                  <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Compute</span><span className="font-mono text-sm font-semibold text-[#22c55e]">-{formatCost(result.freeComputeSavings)}</span></div>
                  <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Requests</span><span className="font-mono text-sm font-semibold text-[#22c55e]">-{formatCost(result.freeRequestSavings)}</span></div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center px-4 py-8 text-text-dim text-[13px]">Enter invocation count to see cost estimates</div>
          )}
        </div>
      </div>
    </div>
  );
}
