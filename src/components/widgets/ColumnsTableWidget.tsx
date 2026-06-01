/**
 * Columns editor — used by SQL database and data-warehouse nodes.
 *
 * YAML shape on disk (matches what `sql-schema.ts` and
 * `warehouse-schema.ts` parse):
 *
 *   <table-name>:
 *     - { name: id, type: uuid, primary: true }
 *     - { name: email, type: text, nullable: false, unique: true }
 *
 * UI: one tab per table, each containing a list of column rows with
 * name, type, and the common booleans (primary, nullable, unique).
 * Foreign-key `references` and `default` are exposed as text inputs.
 */

import { useMemo, useState } from "react";
import { dumpYaml, parseYaml } from "./yaml-helpers";

interface Column {
  name: string;
  type: string;
  nullable?: boolean;
  primary?: boolean;
  unique?: boolean;
  default?: string;
  references?: string;
}

type Tables = Record<string, Column[]>;

interface Props {
  value: string | undefined;
  onChange: (yaml: string) => void;
}

const COMMON_TYPES = [
  "uuid",
  "text",
  "varchar(255)",
  "integer",
  "bigint",
  "boolean",
  "timestamptz",
  "date",
  "jsonb",
  "numeric",
];

export default function ColumnsTableWidget({ value, onChange }: Props) {
  const parsed = useMemo(() => parseYaml<Tables>(value), [value]);
  const isInvalid = value && value.trim() && parsed === undefined;
  const [activeTable, setActiveTable] = useState<string | null>(null);

  if (isInvalid) {
    return <FallbackTextarea value={value} onChange={onChange} note="YAML parse failed — edit raw" />;
  }

  const tables: Tables = parsed ?? {};
  const tableNames = Object.keys(tables);
  const current = activeTable && tables[activeTable] ? activeTable : tableNames[0] ?? null;

  function update(next: Tables) {
    onChange(Object.keys(next).length === 0 ? "" : dumpYaml(next));
  }

  function addTable() {
    const base = "new_table";
    let name = base;
    let i = 1;
    while (tables[name]) name = `${base}_${i++}`;
    update({ ...tables, [name]: [{ name: "id", type: "uuid", primary: true }] });
    setActiveTable(name);
  }

  function renameTable(oldName: string, newName: string) {
    if (oldName === newName || !newName.trim() || tables[newName]) return;
    const next: Tables = {};
    for (const [k, v] of Object.entries(tables)) next[k === oldName ? newName : k] = v;
    update(next);
    if (activeTable === oldName) setActiveTable(newName);
  }

  function deleteTable(name: string) {
    const { [name]: _, ...rest } = tables;
    void _;
    update(rest);
    if (activeTable === name) setActiveTable(null);
  }

  function updateColumns(table: string, columns: Column[]) {
    update({ ...tables, [table]: columns });
  }

  return (
    <div className="flex flex-col gap-2 border border-border rounded-md p-2 bg-surface-2">
      <div className="flex items-center gap-1 flex-wrap">
        {tableNames.map((t) => (
          <button
            key={t}
            className={`text-[11px] px-2 py-0.5 rounded font-mono ${
              t === current
                ? "bg-accent text-white"
                : "bg-surface-3 text-text-dim hover:text-text-bright"
            }`}
            onClick={() => setActiveTable(t)}
          >
            {t}
          </button>
        ))}
        <button
          className="text-[11px] text-accent hover:text-text-bright transition-colors duration-150 ml-auto"
          onClick={addTable}
        >
          + table
        </button>
      </div>

      {current && (
        <TableEditor
          name={current}
          columns={tables[current] ?? []}
          onColumnsChange={(c) => updateColumns(current, c)}
          onRename={(n) => renameTable(current, n)}
          onDelete={() => deleteTable(current)}
        />
      )}

      {tableNames.length === 0 && (
        <p className="text-[11px] text-text-dim italic">No tables yet. Click + table to add one.</p>
      )}
    </div>
  );
}

interface TableEditorProps {
  name: string;
  columns: Column[];
  onColumnsChange: (cols: Column[]) => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

function TableEditor({ name, columns, onColumnsChange, onRename, onDelete }: TableEditorProps) {
  function update(idx: number, col: Partial<Column>) {
    const next = columns.map((c, i) => (i === idx ? { ...c, ...col } : c));
    onColumnsChange(next);
  }

  function add() {
    onColumnsChange([...columns, { name: "", type: "text" }]);
  }

  function remove(idx: number) {
    onColumnsChange(columns.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          // Uncontrolled + onBlur so we rename once the user finishes editing
          // rather than on every keystroke (which would rewrite the YAML key
          // mid-typing and make the field impossible to clear). `key={name}`
          // resets the field when the active table changes or is renamed.
          key={name}
          className="flex-1 bg-surface border border-border rounded px-2 py-1 text-[12px] font-mono text-text-bright outline-none focus:border-accent"
          defaultValue={name}
          onBlur={(e) => onRename(e.target.value)}
        />
        <button
          className="text-[10px] px-2 py-1 rounded text-text-dim hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.12)] transition-colors"
          onClick={onDelete}
          title="Delete table"
        >
          drop
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {columns.map((c, idx) => (
          <ColumnRow key={idx} col={c} onChange={(d) => update(idx, d)} onRemove={() => remove(idx)} />
        ))}
      </div>
      <button
        className="text-[11px] text-accent hover:text-text-bright self-start transition-colors duration-150"
        onClick={add}
      >
        + column
      </button>
    </div>
  );
}

interface ColumnRowProps {
  col: Column;
  onChange: (c: Partial<Column>) => void;
  onRemove: () => void;
}

function ColumnRow({ col, onChange, onRemove }: ColumnRowProps) {
  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-1 items-center">
      <input
        className="bg-surface border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-text-bright outline-none focus:border-accent min-w-0"
        value={col.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="column_name"
      />
      <input
        className="bg-surface border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-text-bright outline-none focus:border-accent min-w-0"
        value={col.type}
        onChange={(e) => onChange({ type: e.target.value })}
        list="column-types"
        placeholder="text"
      />
      <button
        className="text-text-dim hover:text-[#ef4444] text-[10px] px-1"
        onClick={onRemove}
        title="Remove column"
      >
        ×
      </button>
      <datalist id="column-types">
        {COMMON_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <div className="col-span-3 flex items-center gap-2 px-1 pb-1 flex-wrap">
        <Flag label="PK" checked={!!col.primary} onToggle={(v) => onChange({ primary: v || undefined })} />
        <Flag label="NOT NULL" checked={col.nullable === false} onToggle={(v) => onChange({ nullable: v ? false : undefined })} />
        <Flag label="UNIQUE" checked={!!col.unique} onToggle={(v) => onChange({ unique: v || undefined })} />
        <input
          className="flex-1 min-w-[60px] bg-transparent border-b border-border text-[10px] font-mono text-text-dim outline-none focus:border-accent"
          value={col.default ?? ""}
          onChange={(e) => onChange({ default: e.target.value || undefined })}
          placeholder="default ="
        />
        <input
          className="flex-1 min-w-[80px] bg-transparent border-b border-border text-[10px] font-mono text-text-dim outline-none focus:border-accent"
          value={col.references ?? ""}
          onChange={(e) => onChange({ references: e.target.value || undefined })}
          placeholder="references table(col)"
        />
      </div>
    </div>
  );
}

function Flag({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1 cursor-pointer text-[10px] text-text-dim">
      <input
        type="checkbox"
        className="cursor-pointer"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
      />
      {label}
    </label>
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
