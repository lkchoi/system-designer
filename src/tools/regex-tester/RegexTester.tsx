import { useState, useMemo } from "react";
import { testRegex, COMMON_PATTERNS } from "./regex";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function RegexTester({ open, onClose }: Props) {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [input, setInput] = useState("");

  const result = useMemo(() => testRegex(pattern, flags, input), [pattern, flags, input]);

  if (!open) return null;

  const toggleFlag = (flag: string) => {
    setFlags((prev) => (prev.includes(flag) ? prev.replace(flag, "") : prev + flag));
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl w-[560px] max-w-[90vw] max-h-[85vh] flex flex-col shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="flex items-center justify-between px-6 pt-5 shrink-0">
          <span className="text-base font-bold text-text-bright">Regex Tester</span>
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
            <div className="flex items-center gap-2">
              <label className="flex flex-col gap-[5px] flex-1">
                <span className="text-xs font-medium text-text-dim">Pattern</span>
                <input
                  className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="\\d+"
                  spellCheck={false}
                  autoFocus
                />
              </label>
              <div className="flex flex-col gap-[5px]">
                <span className="text-xs font-medium text-text-dim">Flags</span>
                <div className="flex gap-0.5">
                  {["g", "i", "m", "s"].map((f) => (
                    <button
                      key={f}
                      className={`w-7 h-[34px] flex items-center justify-center rounded-md text-xs font-bold transition-all duration-150 ${flags.includes(f) ? "text-white bg-accent" : "text-text-dim bg-surface-2 border border-border hover:text-text-bright"}`}
                      onClick={() => toggleFlag(f)}
                      title={{ g: "global", i: "case insensitive", m: "multiline", s: "dotAll" }[f]}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Test string</span>
              <textarea
                className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 resize-y min-h-[80px] focus:border-accent"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter text to test against..."
                spellCheck={false}
              />
            </label>
          </div>

          <div className="h-px bg-border my-5" />

          {result.error && (
            <div className="text-[13px] text-[#ef4444] bg-[rgba(239,68,68,0.08)] rounded-lg px-3.5 py-2.5 mb-4">
              {result.error}
            </div>
          )}

          {pattern && result.isValid && (
            <div className="flex flex-col gap-[18px]">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[13px] font-medium px-2.5 py-1 rounded-md ${result.matchCount > 0 ? "text-[#22c55e] bg-[rgba(34,197,94,0.08)]" : "text-text-dim bg-surface-2"}`}
                >
                  {result.matchCount} match{result.matchCount !== 1 ? "es" : ""}
                </span>
              </div>
              {result.matches.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
                    Matches
                  </span>
                  {result.matches.map((m, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-2 rounded-md bg-surface-2 border border-border"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-sm font-semibold text-text-bright">
                          {m.text}
                        </span>
                        <span className="text-[11px] text-text-dim">index {m.index}</span>
                      </div>
                      {m.groups.length > 0 && (
                        <div className="flex gap-1.5 mt-1">
                          {m.groups.map((g, gi) => (
                            <span
                              key={gi}
                              className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-accent"
                            >
                              ${gi + 1}: {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="h-px bg-border my-4" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">
              Common patterns
            </span>
            {COMMON_PATTERNS.map((p) => (
              <button
                key={p.label}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors duration-100 text-left hover:bg-surface-2"
                onClick={() => setPattern(p.pattern)}
              >
                <span className="text-[13px] text-text">
                  {p.label} <span className="text-text-dim text-[11px]">— {p.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
