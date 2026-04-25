import { useState, useMemo } from "react";
import { estimatePayloadSize, formatBytes, type PayloadField } from "./payload";

interface Props {
  open: boolean;
  onClose: () => void;
}

const FIELD_TYPES: PayloadField["type"][] = ["string", "number", "boolean", "uuid", "timestamp", "nested"];

export default function PayloadSizeEstimator({ open, onClose }: Props) {
  const [fields, setFields] = useState<PayloadField[]>([
    { name: "id", type: "uuid" },
    { name: "name", type: "string", avgLength: 30 },
    { name: "email", type: "string", avgLength: 25 },
    { name: "active", type: "boolean" },
    { name: "created_at", type: "timestamp" },
  ]);

  const result = useMemo(() => estimatePayloadSize(fields), [fields]);

  const addField = () => setFields((prev) => [...prev, { name: "", type: "string", avgLength: 20 }]);
  const removeField = (i: number) => setFields((prev) => prev.filter((_, idx) => idx !== i));
  const updateField = (i: number, partial: Partial<PayloadField>) => setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...partial } : f)));

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-[560px] max-w-[90vw] max-h-[85vh] flex flex-col shadow-[0_16px_50px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <div className="flex items-center justify-between px-6 pt-5 shrink-0">
          <span className="text-base font-bold text-text-bright">Payload Size Estimator</span>
          <button className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-2 hover:text-text-bright" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 pt-5 pb-6 overflow-y-auto flex-1 min-h-0">
          <div className="flex flex-col gap-2">
            {fields.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-border bg-surface-2 text-text-bright text-sm outline-none transition-[border-color] duration-150 focus:border-accent" value={f.name} onChange={(e) => updateField(i, { name: e.target.value })} placeholder="field name" />
                <select className="px-2 py-1.5 rounded-lg border border-border bg-surface-2 text-text-bright text-[13px] outline-none cursor-pointer focus:border-accent" value={f.type} onChange={(e) => updateField(i, { type: e.target.value as PayloadField["type"] })}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {(f.type === "string") && (
                  <input className="w-[50px] px-2 py-1.5 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none text-right transition-[border-color] duration-150 focus:border-accent" type="number" min="1" value={f.avgLength ?? 20} onChange={(e) => updateField(i, { avgLength: parseInt(e.target.value) || 1 })} title="avg length" />
                )}
                {f.type === "nested" && (
                  <input className="w-[50px] px-2 py-1.5 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none text-right transition-[border-color] duration-150 focus:border-accent" type="number" min="1" value={f.count ?? 1} onChange={(e) => updateField(i, { count: parseInt(e.target.value) || 1 })} title="item count" />
                )}
                <button className="w-6 h-6 flex items-center justify-center rounded-md text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-2 hover:text-[#ef4444]" onClick={() => removeField(i)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          <button className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-accent bg-transparent transition-all duration-150 mt-2 hover:bg-accent-bg" onClick={addField}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Add Field
          </button>

          <div className="h-px bg-border my-5" />

          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">Estimated Wire Size</span>
            <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">JSON</span><span className="font-mono text-sm font-semibold text-text-bright">{formatBytes(result.jsonBytes)}</span></div>
            <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">JSON + gzip</span><span className="font-mono text-sm font-semibold text-text-bright">{formatBytes(result.gzipJsonBytes)} <span className="text-[#22c55e] text-[11px]">(-{result.savingsGzip.toFixed(0)}%)</span></span></div>
            <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Protobuf</span><span className="font-mono text-sm font-semibold text-text-bright">{formatBytes(result.protobufBytes)} <span className="text-[#22c55e] text-[11px]">(-{result.savingsProtobuf.toFixed(0)}%)</span></span></div>
            <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">MessagePack</span><span className="font-mono text-sm font-semibold text-text-bright">{formatBytes(result.msgpackBytes)} <span className="text-[#22c55e] text-[11px]">(-{result.savingsMsgpack.toFixed(0)}%)</span></span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
