import { useReactFlow, NodeResizer } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import type { TextNodeData, TextSize } from "../types";

const SIZE_STYLES: Record<TextSize, { fontSize: string; fontWeight: number; lineHeight: string }> =
  {
    large: { fontSize: "24px", fontWeight: 700, lineHeight: "1.3" },
    medium: { fontSize: "16px", fontWeight: 600, lineHeight: "1.4" },
    small: { fontSize: "13px", fontWeight: 400, lineHeight: "1.5" },
  };

type TextFlowNode = Node<TextNodeData, "text">;

export default function TextNode({ id, data, selected }: NodeProps<TextFlowNode>) {
  const { updateNodeData, deleteElements } = useReactFlow();
  const style = SIZE_STYLES[data.size];

  return (
    <>
      {selected && (
        <NodeResizer
          minWidth={120}
          minHeight={32}
          lineStyle={{ border: "1px dashed var(--border)" }}
          handleStyle={{
            width: 8,
            height: 8,
            background: "var(--accent)",
            border: "none",
            borderRadius: 2,
          }}
        />
      )}
      <div className="p-1.5 w-full h-full box-border flex flex-col min-w-[120px]">
        <textarea
          className={`bg-transparent border-none outline-none resize-none text-text-bright font-sans w-full flex-1 p-0 tracking-tight break-words whitespace-pre-wrap placeholder:text-text-dim${selected ? " border-b border-border pb-1 mb-1.5" : ""}`}
          style={{
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
          }}
          value={data.text}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder={
            data.size === "large"
              ? "Title..."
              : data.size === "medium"
                ? "Heading..."
                : "Description..."
          }
        />
        {selected && (
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex gap-0.5">
              {(["large", "medium", "small"] as TextSize[]).map((s) => (
                <button
                  key={s}
                  className={`px-2 py-0.5 rounded text-[11px] text-text-dim transition-all duration-150 hover:text-text-bright hover:bg-surface-3${data.size === s ? " text-text-bright bg-accent" : ""}`}
                  onClick={() => updateNodeData(id, { size: s })}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <button
              className="flex items-center justify-center w-5 h-5 rounded text-text-dim p-0 transition-all duration-150 hover:bg-[rgba(239,68,68,0.12)] hover:text-[#ef4444]"
              onClick={() => deleteElements({ nodes: [{ id }] })}
              onPointerDown={(e) => e.stopPropagation()}
              title="Delete"
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
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
