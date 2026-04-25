import { useState, useMemo } from "react";
import {
  analyzeShardKey,
  COMPOUND_KEY_STRATEGIES,
  SHARD_KEY_EXAMPLES,
  type ShardKeyCandidate,
} from "./shard";

interface Props {
  open: boolean;
  onClose: () => void;
}

function ScoreBadge({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const display = invert ? 100 - value : value;
  const color =
    display >= 75 ? "text-[#22c55e]" : display >= 50 ? "text-[#eab308]" : "text-[#ef4444]";
  return (
    <div className="flex flex-col items-center gap-1 bg-surface-2 rounded-lg px-3 py-2 flex-1">
      <span className={`font-mono text-lg font-bold ${color}`}>{display}</span>
      <span className="text-[10px] text-text-dim text-center">{label}</span>
    </div>
  );
}

export default function ShardKeyAnalyzer({ open, onClose }: Props) {
  const [name, setName] = useState("user_id");
  const [cardinality, setCardinality] = useState<ShardKeyCandidate["cardinality"]>("high");
  const [distribution, setDistribution] = useState<ShardKeyCandidate["distribution"]>("uniform");
  const [queryPattern, setQueryPattern] = useState<ShardKeyCandidate["queryPattern"]>("point");
  const [growthPattern, setGrowthPattern] = useState<ShardKeyCandidate["growthPattern"]>("random");

  const candidate: ShardKeyCandidate = { name, cardinality, distribution, queryPattern, growthPattern };
  const result = useMemo(() => analyzeShardKey(candidate), [name, cardinality, distribution, queryPattern, growthPattern]);

  const loadExample = (ex: typeof SHARD_KEY_EXAMPLES[0]) => {
    setName(ex.candidate.name);
    setCardinality(ex.candidate.cardinality);
    setDistribution(ex.candidate.distribution);
    setQueryPattern(ex.candidate.queryPattern);
    setGrowthPattern(ex.candidate.growthPattern);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-[560px] max-w-[92vw] max-h-[85vh] flex flex-col shadow-[0_16px_50px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <div className="flex items-center justify-between px-6 pt-5 shrink-0">
          <span className="text-base font-bold text-text-bright">Shard Key Analyzer</span>
          <button className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-2 hover:text-text-bright" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 pt-4 pb-6 overflow-y-auto flex-1 min-h-0">
          {/* Key name */}
          <label className="flex flex-col gap-[5px] mb-3">
            <span className="text-xs font-medium text-text-dim">Shard key field</span>
            <input className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent" value={name} onChange={(e) => setName(e.target.value)} placeholder="user_id" />
          </label>

          {/* Properties */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Cardinality</span>
              <select className="px-2.5 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-[13px] outline-none cursor-pointer focus:border-accent" value={cardinality} onChange={(e) => setCardinality(e.target.value as ShardKeyCandidate["cardinality"])}>
                <option value="low">Low (tens)</option>
                <option value="medium">Medium (thousands)</option>
                <option value="high">High (millions+)</option>
              </select>
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Distribution</span>
              <select className="px-2.5 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-[13px] outline-none cursor-pointer focus:border-accent" value={distribution} onChange={(e) => setDistribution(e.target.value as ShardKeyCandidate["distribution"])}>
                <option value="uniform">Uniform</option>
                <option value="skewed">Skewed (power law)</option>
                <option value="temporal">Temporal (time-based)</option>
              </select>
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Query pattern</span>
              <select className="px-2.5 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-[13px] outline-none cursor-pointer focus:border-accent" value={queryPattern} onChange={(e) => setQueryPattern(e.target.value as ShardKeyCandidate["queryPattern"])}>
                <option value="point">Point lookup</option>
                <option value="range">Range scan</option>
                <option value="scatter">Scatter-gather</option>
              </select>
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Growth pattern</span>
              <select className="px-2.5 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-[13px] outline-none cursor-pointer focus:border-accent" value={growthPattern} onChange={(e) => setGrowthPattern(e.target.value as ShardKeyCandidate["growthPattern"])}>
                <option value="static">Static</option>
                <option value="monotonic">Monotonic (auto-inc/timestamp)</option>
                <option value="random">Random (UUID)</option>
              </select>
            </label>
          </div>

          <div className="h-px bg-border my-4" />

          {/* Scores */}
          <div className="flex gap-2 mb-4">
            <ScoreBadge label="Overall" value={result.overallScore} />
            <ScoreBadge label="Hot Spot Risk" value={result.hotSpotRisk} invert />
            <ScoreBadge label="Cross-Shard Risk" value={result.crossShardQueryRisk} invert />
            <ScoreBadge label="Scalability" value={result.scalabilityScore} />
          </div>

          {/* Recommendation */}
          <div className={`px-3.5 py-2.5 rounded-lg text-[13px] font-medium mb-4 ${
            result.overallScore >= 75
              ? "text-[#22c55e] bg-[rgba(34,197,94,0.08)]"
              : result.overallScore >= 50
                ? "text-[#eab308] bg-[rgba(234,179,8,0.08)]"
                : "text-[#ef4444] bg-[rgba(239,68,68,0.08)]"
          }`}>
            {result.recommendation}
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-4">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px] text-text-dim">
                  <span className="text-[#eab308] shrink-0 mt-0.5">!</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Compound key strategies */}
          {result.overallScore < 75 && (
            <>
              <div className="h-px bg-border my-4" />
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">Compound key strategies</span>
                {COMPOUND_KEY_STRATEGIES.filter((s) =>
                  result.warnings.some((w) => w.toLowerCase().includes(s.mitigates.toLowerCase().split(",")[0].trim().split(" ")[0]))
                  || result.overallScore < 50
                ).map((s) => (
                  <div key={s.name} className="px-2.5 py-2 rounded-md bg-surface-2 border border-border mb-1.5">
                    <div className="text-[13px] font-semibold text-text-bright">{s.name}</div>
                    <div className="text-[12px] text-text-dim mt-0.5">{s.description}</div>
                    <div className="font-mono text-[11px] text-accent mt-1">{s.example}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Examples */}
          <div className="h-px bg-border my-4" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">Try an example</span>
            <div className="flex flex-wrap gap-1.5">
              {SHARD_KEY_EXAMPLES.map((ex) => (
                <button key={ex.name} className="px-2.5 py-1.5 rounded-md text-xs font-medium text-text bg-surface-2 border border-border transition-all duration-150 hover:bg-surface-3 hover:text-text-bright" onClick={() => loadExample(ex)}>
                  {ex.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
