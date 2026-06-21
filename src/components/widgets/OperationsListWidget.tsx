/**
 * Operations editor — used by stream-processor nodes.
 *
 * YAML shape (the planned shape; `stream-llm.ts` will consume it once the
 * hybrid generator splits operator skeleton from per-operator LLM body):
 *
 *   - kind: map
 *     body: "Extract userId from event"
 *   - kind: filter
 *     body: "amount > 0"
 *   - kind: window
 *     window_type: tumbling
 *     duration: 5m
 *   - kind: aggregate
 *     body: "Sum amount per userId"
 *
 * UI: ordered list with a kind dropdown and a free-text body. Window
 * operators get an extra row for type + duration.
 */

import { useMemo } from "react";
import { dumpYaml, parseYaml } from "./yaml-helpers";

type Kind = "map" | "filter" | "window" | "aggregate";

interface Operation {
  kind: Kind;
  body?: string;
  window_type?: "tumbling" | "sliding";
  duration?: string;
}

interface Props {
  value: string | undefined;
  onChange: (yaml: string) => void;
}

const KINDS: Kind[] = ["map", "filter", "window", "aggregate"];

export default function OperationsListWidget({ value, onChange }: Props) {
  const parsed = useMemo(() => parseYaml<Operation[]>(value), [value]);
  const isInvalid = value && value.trim() && !Array.isArray(parsed);

  if (isInvalid) {
    return (
      <FallbackTextarea
        value={value}
        onChange={onChange}
        note="YAML must be a list of operations"
      />
    );
  }

  const ops: Operation[] = Array.isArray(parsed) ? parsed : [];

  function update(next: Operation[]) {
    onChange(next.length === 0 ? "" : dumpYaml(next));
  }

  function add(kind: Kind) {
    const op: Operation = { kind };
    if (kind === "window") {
      op.window_type = "tumbling";
      op.duration = "5m";
    } else {
      op.body = "";
    }
    update([...ops, op]);
  }

  function patch(idx: number, p: Partial<Operation>) {
    update(ops.map((o, i) => (i === idx ? { ...o, ...p } : o)));
  }

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= ops.length) return;
    const next = [...ops];
    [next[idx], next[j]] = [next[j], next[idx]];
    update(next);
  }

  function remove(idx: number) {
    update(ops.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-1.5 border border-border rounded-md p-2 bg-surface-2">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-text-dim mr-auto">Operator chain (top to bottom)</span>
        {KINDS.map((k) => (
          <button
            key={k}
            className="text-[10px] px-2 py-0.5 rounded bg-surface-3 text-text-dim hover:text-text-bright transition-colors"
            onClick={() => add(k)}
            title={`Add ${k}`}
          >
            + {k}
          </button>
        ))}
      </div>
      {ops.length === 0 && <p className="text-[11px] text-text-dim italic">No operators yet.</p>}
      {ops.map((op, idx) => (
        <div key={idx} className="flex flex-col gap-1 bg-surface border border-border rounded p-1.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-dim font-mono w-5 text-right shrink-0">{idx + 1}.</span>
            <select
              className="bg-surface-2 border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-text-bright outline-none focus:border-accent"
              value={op.kind}
              onChange={(e) => patch(idx, { kind: e.target.value as Kind })}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button
              className="text-text-dim hover:text-text-bright text-[10px] px-1 ml-auto"
              disabled={idx === 0}
              onClick={() => move(idx, -1)}
              title="Move up"
            >
              ↑
            </button>
            <button
              className="text-text-dim hover:text-text-bright text-[10px] px-1"
              disabled={idx === ops.length - 1}
              onClick={() => move(idx, 1)}
              title="Move down"
            >
              ↓
            </button>
            <button
              className="text-text-dim hover:text-[#ef4444] text-[10px] px-1"
              onClick={() => remove(idx)}
              title="Remove"
            >
              ×
            </button>
          </div>
          {op.kind === "window" ? (
            <div className="grid grid-cols-2 gap-1">
              <select
                className="bg-surface-2 border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-text-bright outline-none focus:border-accent"
                value={op.window_type ?? "tumbling"}
                onChange={(e) =>
                  patch(idx, { window_type: e.target.value as "tumbling" | "sliding" })
                }
              >
                <option value="tumbling">tumbling</option>
                <option value="sliding">sliding</option>
              </select>
              <input
                className="bg-surface-2 border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-text-bright outline-none focus:border-accent"
                value={op.duration ?? ""}
                onChange={(e) => patch(idx, { duration: e.target.value })}
                placeholder="5m"
              />
            </div>
          ) : (
            <input
              className="bg-surface-2 border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-text-bright outline-none focus:border-accent"
              value={op.body ?? ""}
              onChange={(e) => patch(idx, { body: e.target.value })}
              placeholder={
                op.kind === "filter"
                  ? "amount > 0"
                  : op.kind === "map"
                    ? "Extract userId from event"
                    : "Sum amount per userId"
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FallbackTextarea({
  value,
  onChange,
  note,
}: {
  value: string | undefined;
  onChange: (s: string) => void;
  note: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-[#ef4444]">{note}</span>
      <textarea
        className="bg-surface-2 border border-[#ef4444] rounded-md px-2.5 py-1.5 text-text-bright text-[12px] font-mono outline-none focus:border-accent resize-y min-h-[80px]"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
