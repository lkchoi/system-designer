import { useState, useMemo } from "react";
import { decodeJwt, formatTimestamp, timeUntilExpiry, KNOWN_CLAIMS } from "./jwt";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function JwtInspector({ open, onClose }: Props) {
  const [token, setToken] = useState("");

  const result = useMemo(() => {
    if (!token.trim()) return null;
    return decodeJwt(token);
  }, [token]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl w-[560px] max-w-[90vw] max-h-[85vh] flex flex-col shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        <div className="flex items-center justify-between px-6 pt-5 shrink-0">
          <span className="text-base font-bold text-text-bright">JWT Inspector</span>
          <button className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-2 hover:text-text-bright" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 pt-5 pb-6 overflow-y-auto flex-1 min-h-0">
          <label className="flex flex-col gap-[5px]">
            <span className="text-xs font-medium text-text-dim">Paste JWT</span>
            <textarea
              className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-xs font-mono outline-none transition-[border-color] duration-150 resize-y min-h-[80px] break-all focus:border-accent"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              spellCheck={false}
              autoFocus
            />
          </label>

          {result && "error" in result && (
            <>
              <div className="h-px bg-border my-4" />
              <div className="text-[13px] text-[#ef4444] bg-[rgba(239,68,68,0.08)] rounded-lg px-3.5 py-2.5">
                {result.error}
              </div>
            </>
          )}

          {result && !("error" in result) && (
            <>
              <div className="h-px bg-border my-4" />

              {result.expiresAt && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-[13px] font-medium ${result.isExpired ? "text-[#ef4444] bg-[rgba(239,68,68,0.08)]" : "text-[#22c55e] bg-[rgba(34,197,94,0.08)]"}`}>
                  <span>{result.isExpired ? "Expired" : "Valid"}</span>
                  <span className="text-text-dim">—</span>
                  <span className="font-mono">{timeUntilExpiry(result.expiresAt)}</span>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Header</span>
                  <pre className="mt-1 px-3 py-2 rounded-lg bg-surface-2 border border-border text-xs font-mono text-text-bright overflow-x-auto">
                    {JSON.stringify(result.header, null, 2)}
                  </pre>
                </div>

                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Payload</span>
                  <pre className="mt-1 px-3 py-2 rounded-lg bg-surface-2 border border-border text-xs font-mono text-text-bright overflow-x-auto">
                    {JSON.stringify(result.payload, null, 2)}
                  </pre>
                </div>

                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">Claims</span>
                  <div className="flex flex-col gap-0.5 mt-1">
                    {Object.entries(result.payload).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between py-[3px]">
                        <span className="text-[13px] text-text">
                          <span className="font-mono text-accent">{key}</span>
                          {KNOWN_CLAIMS[key] && <span className="text-text-dim ml-1.5 text-[11px]">({KNOWN_CLAIMS[key]})</span>}
                        </span>
                        <span className="font-mono text-sm text-text-bright max-w-[60%] text-right truncate">
                          {key === "exp" || key === "iat" || key === "nbf"
                            ? formatTimestamp(typeof value === "number" ? new Date(value * 1000) : null)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
