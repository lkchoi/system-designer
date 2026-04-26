import { useState, useMemo } from "react";
import { computeSla, formatDowntime, COMMON_SLAS, type SlaComponent } from "./sla";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SlaCalculator({ open, onClose }: Props) {
  const [mode, setMode] = useState<"series" | "parallel">("series");
  const [components, setComponents] = useState<SlaComponent[]>([
    { name: "Load Balancer", availability: 99.99 },
    { name: "API Service", availability: 99.9 },
    { name: "Database", availability: 99.95 },
  ]);

  const result = useMemo(
    () => (components.length > 0 ? computeSla(components, mode) : null),
    [components, mode],
  );

  const addComponent = () => {
    setComponents((prev) => [
      ...prev,
      { name: `Component ${prev.length + 1}`, availability: 99.9 },
    ]);
  };

  const removeComponent = (index: number) => {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, partial: Partial<SlaComponent>) => {
    setComponents((prev) => prev.map((c, i) => (i === index ? { ...c, ...partial } : c)));
  };

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
          <div className="flex items-center gap-4">
            <span className="text-base font-bold text-text-bright">SLA Calculator</span>
            <div className="flex gap-0.5 bg-surface-2 rounded-lg p-0.5">
              <button
                className={`text-xs font-medium text-text-dim px-3 py-[5px] rounded-md transition-all duration-150 hover:text-text${mode === "series" ? " text-white bg-accent" : ""}`}
                onClick={() => setMode("series")}
              >
                Series
              </button>
              <button
                className={`text-xs font-medium text-text-dim px-3 py-[5px] rounded-md transition-all duration-150 hover:text-text${mode === "parallel" ? " text-white bg-accent" : ""}`}
                onClick={() => setMode("parallel")}
              >
                Parallel
              </button>
            </div>
          </div>
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
          <div className="text-[11px] text-text-dim mb-3">
            {mode === "series"
              ? "Components in series — all must be up. Composite = A × B × C..."
              : "Components in parallel — any one suffices. Composite = 1 − (1−A)(1−B)..."}
          </div>

          <div className="flex flex-col gap-2">
            {components.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm outline-none transition-[border-color] duration-150 focus:border-accent"
                  value={c.name}
                  onChange={(e) => updateComponent(i, { name: e.target.value })}
                  placeholder="Component name"
                />
                <div className="flex items-center gap-1">
                  <input
                    className="w-[90px] px-2 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 text-right focus:border-accent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={c.availability}
                    onChange={(e) =>
                      updateComponent(i, { availability: parseFloat(e.target.value) || 0 })
                    }
                  />
                  <span className="text-xs text-text-dim">%</span>
                </div>
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-2 hover:text-[#ef4444]"
                  onClick={() => removeComponent(i)}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <button
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-accent bg-transparent transition-all duration-150 mt-2 hover:bg-accent-bg"
            onClick={addComponent}
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
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Component
          </button>

          {result && (
            <>
              <div className="h-px bg-border my-5" />
              <div className="flex flex-col gap-[18px]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                    Composite Availability
                  </span>
                  <span className="text-xl font-bold font-mono text-text-bright">
                    {result.composite < 99
                      ? result.composite.toFixed(2)
                      : result.composite.toFixed(
                          Math.max(2, -Math.floor(Math.log10(100 - result.composite)) + 1),
                        )}
                    %
                  </span>
                  <span className="text-xs text-text-dim">{result.nines}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
                    Downtime Budget
                  </span>
                  <div className="flex items-center justify-between py-[3px]">
                    <span className="text-[13px] text-text">Per month</span>
                    <span className="font-mono text-sm font-semibold text-text-bright">
                      {formatDowntime(result.downtimeMinutesPerMonth)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-[3px]">
                    <span className="text-[13px] text-text">Per year</span>
                    <span className="font-mono text-sm font-semibold text-text-bright">
                      {formatDowntime(result.downtimeMinutesPerYear)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-[3px]">
                    <span className="text-[13px] text-text">Error budget</span>
                    <span className="font-mono text-sm font-semibold text-text-bright">
                      {result.errorBudgetPercent < 0.01
                        ? result.errorBudgetPercent.toExponential(2)
                        : result.errorBudgetPercent.toFixed(4)}
                      %
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="h-px bg-border my-4" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
              Common SLAs
            </span>
            {COMMON_SLAS.map((s) => (
              <div
                key={s.value}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors duration-100 hover:bg-surface-2"
              >
                <span className="text-[13px] text-text">{s.label}</span>
                <span className="font-mono text-[13px] text-text-dim">
                  {formatDowntime((1 - s.value / 100) * 30 * 24 * 60)}/mo
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
