/**
 * Field-mappings editor — used by search-engine nodes.
 *
 * YAML shape (matches `search-mapping.ts`):
 *   fields:
 *     title: { type: text, analyzer: standard }
 *     created_at: { type: date }
 *     tags: { type: keyword }
 *   settings:
 *     number_of_shards: 3
 *
 * UI: a flat list of `field-name → type` rows under a "fields" header.
 * We do not expose `settings` in the widget for v1 — most settings are
 * rarely tuned per-index. If the value already contains settings we
 * preserve them on serialize.
 */

import { useMemo } from "react";
import { dumpYaml, parseYaml } from "./yaml-helpers";

interface FieldMapping {
  type: string;
  analyzer?: string;
  indexed?: boolean;
}

interface MappingsValue {
  fields?: Record<string, FieldMapping>;
  settings?: Record<string, unknown>;
}

interface Props {
  value: string | undefined;
  onChange: (yaml: string) => void;
}

const COMMON_FIELD_TYPES = [
  "text",
  "keyword",
  "long",
  "integer",
  "double",
  "boolean",
  "date",
  "ip",
  "geo_point",
  "nested",
];

export default function MappingsObjectWidget({ value, onChange }: Props) {
  const parsed = useMemo(() => parseYaml<MappingsValue>(value), [value]);
  const isInvalid =
    value && value.trim() && (parsed === undefined || (typeof parsed !== "object" || Array.isArray(parsed)));

  if (isInvalid) {
    return <FallbackTextarea value={value} onChange={onChange} note="YAML parse failed — edit raw" />;
  }

  const fields = (parsed?.fields ?? {}) as Record<string, FieldMapping>;
  const settings = parsed?.settings;
  const fieldEntries = Object.entries(fields);

  function update(nextFields: Record<string, FieldMapping>) {
    const next: MappingsValue = { fields: nextFields };
    if (settings) next.settings = settings;
    onChange(Object.keys(nextFields).length === 0 && !settings ? "" : dumpYaml(next));
  }

  function addField() {
    const base = "new_field";
    let name = base;
    let i = 1;
    while (fields[name]) name = `${base}_${i++}`;
    update({ ...fields, [name]: { type: "text" } });
  }

  function rename(oldKey: string, newKey: string) {
    if (oldKey === newKey || !newKey.trim() || fields[newKey]) return;
    const next: Record<string, FieldMapping> = {};
    for (const [k, v] of Object.entries(fields)) next[k === oldKey ? newKey : k] = v;
    update(next);
  }

  function patch(key: string, p: Partial<FieldMapping>) {
    update({ ...fields, [key]: { ...fields[key], ...p } });
  }

  function remove(key: string) {
    const { [key]: _, ...rest } = fields;
    void _;
    update(rest);
  }

  return (
    <div className="flex flex-col gap-1.5 border border-border rounded-md p-2 bg-surface-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-dim uppercase tracking-wide">fields</span>
        <button
          className="text-[11px] text-accent hover:text-text-bright transition-colors"
          onClick={addField}
        >
          + field
        </button>
      </div>
      {fieldEntries.length === 0 && (
        <p className="text-[11px] text-text-dim italic">No fields yet.</p>
      )}
      {fieldEntries.map(([name, mapping]) => (
        <div key={name} className="grid grid-cols-[1fr_1fr_auto] gap-1 items-center">
          <input
            className="bg-surface border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-text-bright outline-none focus:border-accent min-w-0"
            defaultValue={name}
            onBlur={(e) => rename(name, e.target.value)}
            placeholder="field_name"
          />
          <input
            className="bg-surface border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-text-bright outline-none focus:border-accent min-w-0"
            value={mapping.type}
            onChange={(e) => patch(name, { type: e.target.value })}
            list="search-field-types"
            placeholder="type"
          />
          <button
            className="text-text-dim hover:text-[#ef4444] text-[10px] px-1"
            onClick={() => remove(name)}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <datalist id="search-field-types">
        {COMMON_FIELD_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {settings && (
        <p className="text-[10px] text-text-dim italic mt-1">
          (preserving custom `settings` block from raw YAML)
        </p>
      )}
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
