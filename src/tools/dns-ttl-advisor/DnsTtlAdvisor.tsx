import { useState, useMemo } from "react";
import { computeDnsTtl, formatTtl, COMMON_TTLS } from "./dns";

interface Props {
  open: boolean;
  onClose: () => void;
}

const FREQ_OPTIONS = [
  { id: "rarely" as const, label: "Rarely (weeks/months)" },
  { id: "daily" as const, label: "Daily" },
  { id: "hourly" as const, label: "Hourly" },
  { id: "minutes" as const, label: "Every few minutes" },
];

export default function DnsTtlAdvisor({ open, onClose }: Props) {
  const [rps, setRps] = useState("1000");
  const [freq, setFreq] = useState<"rarely" | "daily" | "hourly" | "minutes">("daily");
  const [failover, setFailover] = useState(false);

  const result = useMemo(
    () =>
      computeDnsTtl({
        requestsPerSecond: parseFloat(rps) || 0,
        changeFrequency: freq,
        failoverRequired: failover,
      }),
    [rps, freq, failover],
  );

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
          <span className="text-base font-bold text-text-bright">DNS TTL Advisor</span>
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
          <div className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">DNS queries/sec</span>
              <input
                className="w-[140px] px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                type="number"
                min="0"
                value={rps}
                onChange={(e) => setRps(e.target.value)}
              />
            </label>
            <div className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">
                How often do records change?
              </span>
              <div className="flex gap-0.5 bg-surface-2 rounded-lg p-0.5">
                {FREQ_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    className={`flex-1 text-[11px] font-medium text-text-dim px-2 py-[5px] rounded-md transition-all duration-150 hover:text-text${freq === f.id ? " text-white bg-accent" : ""}`}
                    onClick={() => setFreq(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={failover}
                onChange={(e) => setFailover(e.target.checked)}
                className="accent-accent"
              />
              <span className="text-xs font-medium text-text-dim">
                Fast failover required (&le;60s)
              </span>
            </label>
          </div>

          <div className="h-px bg-border my-5" />

          <div className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                Recommendation
              </span>
              <span className="text-xl font-bold font-mono text-text-bright">
                {formatTtl(result.recommendedTtl)} ({result.recommendedTtl}s)
              </span>
            </div>
            <div className="text-[13px] text-text-dim bg-surface-2 rounded-lg px-3.5 py-2.5">
              {result.tradeoff}
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between py-[3px]">
                <span className="text-[13px] text-text">Max propagation delay</span>
                <span className="font-mono text-sm font-semibold text-text-bright">
                  {result.propagationTime}
                </span>
              </div>
              <div className="flex items-center justify-between py-[3px]">
                <span className="text-[13px] text-text">Cache hit rate</span>
                <span className="font-mono text-sm font-semibold text-text-bright">
                  {result.cacheBenefit.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="h-px bg-border my-4" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
              Common TTLs
            </span>
            {COMMON_TTLS.map((t) => (
              <div
                key={t.seconds}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors duration-100 hover:bg-surface-2"
              >
                <span className="text-[13px] text-text">
                  {t.label} — <span className="text-text-dim">{t.useCase}</span>
                </span>
                <span className="font-mono text-[13px] font-semibold text-text-bright">
                  {t.seconds}s
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
