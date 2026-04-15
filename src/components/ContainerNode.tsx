import { useState, useRef, useEffect } from "react";
import { Handle, Position, useReactFlow, NodeResizer } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import type { ContainerNodeData } from "../types";

type ContainerNode = Node<ContainerNodeData, "container">;

export default function ContainerNode({ id, data, selected }: NodeProps<ContainerNode>) {
  const { deleteElements, updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    setDraft(data.label);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (draft.trim()) {
      updateNodeData(id, { label: draft.trim() });
    }
  }

  return (
    <>
      {selected && (
        <NodeResizer
          minWidth={240}
          minHeight={120}
          lineStyle={{ border: "1px solid var(--accent)", zIndex: 0 }}
          handleStyle={{
            width: 8,
            height: 8,
            background: "var(--accent)",
            border: "none",
            borderRadius: 2,
            zIndex: 5,
          }}
        />
      )}
      <Handle type="source" position={Position.Top} id="top" className="system-handle" />
      <Handle type="source" position={Position.Left} id="left" className="system-handle" />
      <div
        className={`rounded-xl border border-dashed w-full h-full min-w-[240px] min-h-[120px] transition-[border-color,box-shadow] duration-150${
          selected
            ? " border-accent shadow-[0_0_0_1px_var(--color-accent),0_0_20px_rgba(99,102,241,0.15)]"
            : " border-border"
        }`}
        style={{ background: data.color || "rgba(99,102,241,0.04)" }}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-dashed border-border">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-dim shrink-0"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          {editing ? (
            <input
              ref={inputRef}
              className="flex-1 bg-transparent border-none text-sm font-semibold text-text-bright outline-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            <span
              className="flex-1 text-sm font-semibold text-text-dim cursor-text select-none"
              onDoubleClick={(e) => {
                e.stopPropagation();
                startEdit();
              }}
            >
              {data.label || "Container"}
            </span>
          )}
          <button
            className="flex items-center justify-center w-5 h-5 rounded text-text-dim transition-all duration-150 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.12)]"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => deleteElements({ nodes: [{ id }] })}
            title="Delete container"
          >
            <svg
              width="12"
              height="12"
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
      </div>
      <Handle type="source" position={Position.Right} id="right" className="system-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="system-handle" />
    </>
  );
}
