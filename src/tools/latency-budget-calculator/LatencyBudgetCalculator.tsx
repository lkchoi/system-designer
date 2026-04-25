import { useState, useMemo } from "react";
import { computeLatencyBudget, percentOfBudget, COMMON_LATENCIES, type LatencyHop } from "./latency";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LatencyBudgetCalculator({ open, onClose }: Props) {
  const [budget, setBudget] = useState("200");
  const [hops, setHops] = useState<LatencyHop[]>([
    { name: "CDN", p50Ms: 5, p99Ms: 20 },
    { name: "API Gateway", p50Ms: 3, p99Ms: 15 },
    { name: "Service", p50Ms: 10, p99Ms: 50 },
    { name: "Database", p50Ms: 5, p99Ms: 30 },
  ]);

  const budgetMs = parseFloat(budget) || 0;
  const result = useMemo(() => computeLatencyBudget(hops, budgetMs), [hops, budgetMs]);

  const addHop = () => setHops((prev) => [...prev, { name: `Hop ${prev.length + 1}`, p50Ms: 5, p99Ms: 20 }]);
  const removeHop = (i: number) => setHops((prev) => prev.filter((_, idx) => idx !== i));
  const updateHop = (i: number, partial: Partial<LatencyHop>) => setHops((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...partial } : h)));

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-[560px] max-w-[90vw] max-h-[85vh] flex flex-col shadow-[0_16px_50px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <div className="flex items-center justify-between px-6 pt-5 shrink-0">
          <span className="text-base font-bold text-text-bright">Latency Budget Calculator</span>
          <button className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-2 hover:text-text-bright" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 pt-5 pb-6 overflow-y-auto flex-1 min-h-0">
          <label className="flex flex-col gap-[5px] mb-4">
            <span className="text-xs font-medium text-text-dim">End-to-end budget (ms)</span>
            <input className="w-[120px] px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>

          <div className="flex flex-col gap-2">
            {hops.map((hop, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm outline-none transition-[border-color] duration-150 focus:border-accent" value={hop.name} onChange={(e) => updateHop(i, { name: e.target.value })} />
                <div className="flex items-center gap-1">
                  <input className="w-[60px] px-2 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none text-right transition-[border-color] duration-150 focus:border-accent" type="number" min="0" step="0.5" value={hop.p50Ms} onChange={(e) => updateHop(i, { p50Ms: parseFloat(e.target.value) || 0 })} title="p50" />
                  <span className="text-[10px] text-text-dim">p50</span>
                </div>
                <div className="flex items-center gap-1">
                  <input className="w-[60px] px-2 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none text-right transition-[border-color] duration-150 focus:border-accent" type="number" min="0" step="1" value={hop.p99Ms} onChange={(e) => updateHop(i, { p99Ms: parseFloat(e.target.value) || 0 })} title="p99" />
                  <span className="text-[10px] text-text-dim">p99</span>
                </div>
                <button className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-2 hover:text-[#ef4444]" onClick={() => removeHop(i)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          <button className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-accent bg-transparent transition-all duration-150 mt-2 hover:bg-accent-bg" onClick={addHop}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Add Hop
          </button>

          <div className="h-px bg-border my-5" />

          <div className="flex flex-col gap-[18px]">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium ${result.withinBudgetP99 ? "text-[#22c55e] bg-[rgba(34,197,94,0.08)]" : "text-[#ef4444] bg-[rgba(239,68,68,0.08)]"}`}>
              p99: {result.totalP99}ms / {budgetMs}ms ({percentOfBudget(result.totalP99, budgetMs).toFixed(0)}%)
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">Summary</span>
              <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Total p50</span><span className="font-mono text-sm font-semibold text-text-bright">{result.totalP50}ms</span></div>
              <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Total p99</span><span className="font-mono text-sm font-semibold text-text-bright">{result.totalP99}ms</span></div>
              <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Remaining (p99)</span><span className={`font-mono text-sm font-semibold ${result.remainingP99 >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{result.remainingP99}ms</span></div>
            </div>
            {hops.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">Per-Hop Budget Share (p99)</span>
                {hops.map((h, i) => (
                  <div key={i} className="flex items-center justify-between py-[3px]">
                    <span className="text-[13px] text-text">{h.name}</span>
                    <span className="font-mono text-sm text-text-bright">{percentOfBudget(h.p99Ms, budgetMs).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-border my-4" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">Reference latencies</span>
            {COMMON_LATENCIES.map((l) => (
              <button key={l.name} className="flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors duration-100 text-left hover:bg-surface-2" onClick={() => setHops((prev) => [...prev, { name: l.name, p50Ms: l.p50, p99Ms: l.p99 }])}>
                <span className="text-[13px] text-text">{l.name}</span>
                <span className="font-mono text-[12px] text-text-dim">p50: {l.p50}ms / p99: {l.p99}ms</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
