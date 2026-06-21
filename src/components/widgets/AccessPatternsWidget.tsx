/**
 * Access-patterns editor — used by DynamoDB-style database nodes.
 *
 * YAML shape (matches `dynamo-schema.ts`):
 *   - name: "Get user by id"
 *     partition: "USER#<userId>"
 *     sort: "PROFILE"
 *     projection: "all"
 *
 * UI: ordered list of pattern rows. The first one defines the base
 * table; subsequent rows whose partition template differs become GSIs.
 * A label above the first row hints at this so users can reason about
 * which patterns will spawn an index.
 */

import { useMemo } from "react";
import { dumpYaml, parseYaml } from "./yaml-helpers";

interface AccessPattern {
  name: string;
  partition: string;
  sort?: string;
  filter?: string;
  projection?: "all" | "keys_only";
}

interface Props {
  value: string | undefined;
  onChange: (yaml: string) => void;
}

export default function AccessPatternsWidget({ value, onChange }: Props) {
  const parsed = useMemo(() => parseYaml<AccessPattern[]>(value), [value]);
  const isInvalid = value && value.trim() && !Array.isArray(parsed);

  if (isInvalid) {
    return (
      <FallbackTextarea
        value={value}
        onChange={onChange}
        note="YAML must be a list of access patterns"
      />
    );
  }

  const patterns: AccessPattern[] = Array.isArray(parsed) ? parsed : [];

  function update(next: AccessPattern[]) {
    onChange(next.length === 0 ? "" : dumpYaml(next));
  }

  function addPattern() {
    const baseName = patterns.length === 0 ? "Base pattern" : `Pattern ${patterns.length + 1}`;
    update([...patterns, { name: baseName, partition: "", sort: "", projection: "all" }]);
  }

  function patch(idx: number, p: Partial<AccessPattern>) {
    update(patterns.map((x, i) => (i === idx ? { ...x, ...p } : x)));
  }

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= patterns.length) return;
    const next = [...patterns];
    [next[idx], next[j]] = [next[j], next[idx]];
    update(next);
  }

  function remove(idx: number) {
    update(patterns.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-1.5 border border-border rounded-md p-2 bg-surface-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-text-dim italic">
          First pattern → base table. Others with new partition → GSI.
        </p>
        <button
          className="text-[11px] text-accent hover:text-text-bright transition-colors"
          onClick={addPattern}
        >
          + pattern
        </button>
      </div>
      {patterns.length === 0 && (
        <p className="text-[11px] text-text-dim italic">No patterns yet.</p>
      )}
      {patterns.map((p, idx) => (
        <div key={idx} className="flex flex-col gap-1 bg-surface border border-border rounded p-1.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-dim font-mono w-12 shrink-0">
              {idx === 0 ? "[base]" : `[GSI ${idx}]`}
            </span>
            <input
              className="flex-1 bg-surface-2 border border-border rounded px-1.5 py-0.5 text-[11px] text-text-bright outline-none focus:border-accent min-w-0"
              value={p.name}
              onChange={(e) => patch(idx, { name: e.target.value })}
              placeholder="Query name"
            />
            <button
              className="text-text-dim hover:text-text-bright text-[10px] px-1"
              disabled={idx === 0}
              onClick={() => move(idx, -1)}
              title="Move up"
            >
              ↑
            </button>
            <button
              className="text-text-dim hover:text-text-bright text-[10px] px-1"
              disabled={idx === patterns.length - 1}
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
          <div className="grid grid-cols-2 gap-1">
            <input
              className="bg-surface-2 border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-text-bright outline-none focus:border-accent min-w-0"
              value={p.partition}
              onChange={(e) => patch(idx, { partition: e.target.value })}
              placeholder="USER#<userId>"
              title="Partition key template"
            />
            <input
              className="bg-surface-2 border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-text-bright outline-none focus:border-accent min-w-0"
              value={p.sort ?? ""}
              onChange={(e) => patch(idx, { sort: e.target.value || undefined })}
              placeholder="(sort key, optional)"
              title="Sort key template"
            />
          </div>
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
