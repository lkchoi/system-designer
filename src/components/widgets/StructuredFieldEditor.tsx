/**
 * Dispatch a structured plan field to the appropriate widget editor.
 *
 * Each widget reads/writes the underlying value as a YAML string under
 * `data.plan[field.key]` — the same shape buildout generators already
 * read. So introducing a widget never breaks an existing design; it
 * just upgrades the editing UX from "raw YAML in a textarea" to a
 * dedicated control.
 *
 * If a widget fails to parse the current YAML (user typed something
 * invalid in the raw mode), we surface a fallback `<textarea>` with the
 * error message so the user can fix it manually rather than losing
 * their data.
 */

import type { StructuredFieldDef } from "../../registry/types";
import ColumnsTableWidget from "./ColumnsTableWidget";
import AccessPatternsWidget from "./AccessPatternsWidget";
import MappingsObjectWidget from "./MappingsObjectWidget";
import OperationsListWidget from "./OperationsListWidget";

interface Props {
  field: StructuredFieldDef;
  value: string | undefined;
  onChange: (yaml: string) => void;
}

export default function StructuredFieldEditor({ field, value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-text-dim">{field.label}</label>
      {field.description && (
        <p className="text-[11px] text-text-dim leading-snug mb-1">{field.description}</p>
      )}
      {renderWidget(field, value, onChange)}
    </div>
  );
}

function renderWidget(
  field: StructuredFieldDef,
  value: string | undefined,
  onChange: (yaml: string) => void,
) {
  switch (field.type) {
    case "columns-table":
      return <ColumnsTableWidget value={value} onChange={onChange} />;
    case "access-patterns-list":
      return <AccessPatternsWidget value={value} onChange={onChange} />;
    case "mappings-object":
      return <MappingsObjectWidget value={value} onChange={onChange} />;
    case "operations-list":
      return <OperationsListWidget value={value} onChange={onChange} />;
  }
}
