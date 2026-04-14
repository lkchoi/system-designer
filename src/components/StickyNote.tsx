import { NodeResizer, useReactFlow } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import type { StickyNoteData, StickyColor } from "../types";
import { STICKY_COLORS } from "../types";

type StickyNode = Node<StickyNoteData, "sticky">;

export default function StickyNote({ id, data, selected }: NodeProps<StickyNode>) {
  const { updateNodeData, deleteElements } = useReactFlow();

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={140}
        minHeight={100}
        lineStyle={{ border: "1px solid rgba(0,0,0,0.2)" }}
        handleStyle={{
          width: 8,
          height: 8,
          background: "rgba(0,0,0,0.3)",
          border: "none",
          borderRadius: 2,
        }}
      />
      <div
        className={`w-full h-full rounded p-2.5 box-border flex flex-col shadow-[2px_3px_8px_rgba(0,0,0,0.25)] relative${selected ? " shadow-[2px_3px_8px_rgba(0,0,0,0.25),0_0_0_2px_rgba(99,102,241,0.5)]" : ""}`}
        style={{ background: data.color }}
      >
        <textarea
          className="flex-1 bg-transparent border-none outline-none resize-none font-sans text-[13px] leading-normal text-[#1c1917] p-0 placeholder:text-[rgba(0,0,0,0.3)]"
          value={data.text}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Type a note..."
        />
        {selected && (
          <div className="flex items-center justify-between pt-1.5 border-t border-[rgba(0,0,0,0.08)] mt-1.5">
            <div className="flex gap-1">
              {STICKY_COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-4 h-4 rounded-full border-2 ${data.color === c ? "border-[rgba(0,0,0,0.35)]" : "border-transparent"} p-0 cursor-pointer transition-transform duration-100 hover:scale-[1.2]`}
                  style={{ background: c }}
                  onClick={() => updateNodeData(id, { color: c as StickyColor })}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ))}
            </div>
            <button
              className="flex items-center justify-center w-[22px] h-[22px] rounded text-[rgba(0,0,0,0.35)] p-0 transition-all duration-150 hover:bg-[rgba(0,0,0,0.1)] hover:text-[#ef4444]"
              onClick={() => deleteElements({ nodes: [{ id }] })}
              onPointerDown={(e) => e.stopPropagation()}
              title="Delete note"
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
