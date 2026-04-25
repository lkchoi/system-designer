import { useState, useMemo } from "react";
import { cronToNatural, naturalToCron, getNextRuns, PRESETS } from "./cron";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "to-natural" | "to-cron";

export default function CronTranslator({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("to-natural");
  const [cronInput, setCronInput] = useState("0 9 * * 1-5");
  const [nlInput, setNlInput] = useState("");
  const [startFrom, setStartFrom] = useState("");

  const cronResult = useMemo(() => cronToNatural(cronInput), [cronInput]);
  const nlResult = useMemo(() => naturalToCron(nlInput), [nlInput]);

  const fromDate = useMemo(() => {
    if (!startFrom) return undefined;
    const d = new Date(startFrom);
    return isNaN(d.getTime()) ? undefined : d;
  }, [startFrom]);

  const nextRuns = useMemo(() => {
    const expr = tab === "to-natural" ? cronInput : nlResult.cron;
    if (!expr) return [];
    return getNextRuns(expr, 5, fromDate);
  }, [tab, cronInput, nlResult.cron, fromDate]);

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
            <span className="text-base font-bold text-text-bright">Cron Translator</span>
            <div className="flex gap-0.5 bg-surface-2 rounded-lg p-0.5">
              <button
                className={`text-xs font-medium text-text-dim px-3 py-[5px] rounded-md transition-all duration-150 hover:text-text${tab === "to-natural" ? " text-white bg-accent" : ""}`}
                onClick={() => {
                  if (nlResult.cron) setCronInput(nlResult.cron);
                  setTab("to-natural");
                }}
              >
                Cron → Text
              </button>
              <button
                className={`text-xs font-medium text-text-dim px-3 py-[5px] rounded-md transition-all duration-150 hover:text-text${tab === "to-cron" ? " text-white bg-accent" : ""}`}
                onClick={() => {
                  if (!cronResult.error && cronResult.text) setNlInput(cronResult.text);
                  setTab("to-cron");
                }}
              >
                Text → Cron
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
          {tab === "to-natural" && (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-[5px]">
                <span className="text-xs font-medium text-text-dim">Cron expression</span>
                <input
                  className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                  type="text"
                  value={cronInput}
                  onChange={(e) => setCronInput(e.target.value)}
                  placeholder="* * * * *"
                  spellCheck={false}
                  autoFocus
                />
                <span className="text-[11px] text-text-dim font-mono mt-0.5">
                  minute (0-59) &nbsp; hour (0-23) &nbsp; day (1-31) &nbsp; month (1-12) &nbsp;
                  weekday (0-6)
                </span>
              </label>

              <div className="h-px bg-border" />

              {cronResult.error ? (
                <div className="text-[13px] text-[#ef4444] bg-[rgba(239,68,68,0.08)] rounded-lg px-3.5 py-2.5">
                  {cronResult.error}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                    Natural language
                  </span>
                  <span className="text-[15px] font-semibold text-text-bright">
                    {cronResult.text}
                  </span>
                </div>
              )}
            </div>
          )}

          {tab === "to-cron" && (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-[5px]">
                <span className="text-xs font-medium text-text-dim">Describe the schedule</span>
                <input
                  className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm outline-none transition-[border-color] duration-150 focus:border-accent"
                  type="text"
                  value={nlInput}
                  onChange={(e) => setNlInput(e.target.value)}
                  placeholder="e.g. every weekday at 9am"
                  autoFocus
                />
              </label>

              <div className="h-px bg-border" />

              {nlResult.error ? (
                <div className="text-[13px] text-[#ef4444] bg-[rgba(239,68,68,0.08)] rounded-lg px-3.5 py-2.5">
                  {nlResult.error}
                </div>
              ) : nlResult.cron ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                    Cron expression
                  </span>
                  <span className="text-[15px] font-semibold font-mono text-text-bright">
                    {nlResult.cron}
                  </span>
                </div>
              ) : (
                <div className="text-center text-text-dim text-[13px] py-2">
                  Type a schedule description above
                </div>
              )}
            </div>
          )}

          {/* Next runs */}
          {(tab === "to-natural" ? !cronResult.error : !!nlResult.cron) && (
            <>
              <div className="h-px bg-border my-4" />
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                    Next runs
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-dim">from</span>
                    <input
                      className="px-2 py-1 rounded-md border border-border bg-surface-2 text-text-bright text-[12px] font-mono outline-none transition-[border-color] duration-150 w-[180px] focus:border-accent"
                      type="datetime-local"
                      value={startFrom}
                      onChange={(e) => setStartFrom(e.target.value)}
                    />
                    {startFrom && (
                      <button
                        className="text-[11px] text-text-dim hover:text-text-bright transition-colors duration-150"
                        onClick={() => setStartFrom("")}
                        title="Reset to now"
                      >
                        now
                      </button>
                    )}
                  </div>
                </div>
                {nextRuns.length > 0 ? (
                  nextRuns.map((d, i) => (
                    <div key={i} className="flex items-center justify-between py-[3px]">
                      <span className="text-[13px] text-text">
                        {d.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="font-mono text-sm font-semibold text-text-bright">
                        {d.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-text-dim text-[13px] py-2">
                    No upcoming runs found within the next year
                  </div>
                )}
              </div>
            </>
          )}

          {/* Presets */}
          <div className="h-px bg-border my-4" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
              Common presets
            </span>
            <div className="flex flex-col gap-0.5">
              {PRESETS.map((p) => (
                <button
                  key={p.cron}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors duration-100 text-left hover:bg-surface-2"
                  onClick={() => {
                    if (tab === "to-natural") {
                      setCronInput(p.cron);
                    } else {
                      setNlInput(p.label);
                    }
                  }}
                >
                  <span className="text-[13px] text-text">{p.label}</span>
                  <span className="font-mono text-[13px] font-semibold text-text-bright">
                    {p.cron}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
