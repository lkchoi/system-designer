import { useState, useRef, useEffect } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import type { EdgeData } from "../types";
import { useMode, useStress } from "../App";

export default function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const mode = useMode();
  const { partitionedEdges, slowEdges, stressConfig } = useStress();
  const isStressMode = mode === "stress";
  const isPartitioned = partitionedEdges.has(id);
  const isSlow = slowEdges.has(id);

  const edgeData = data as EdgeData | undefined;
  const label = edgeData?.label ?? "";
  const protocol = edgeData?.protocol ?? "";
  const format = edgeData?.format ?? "";
  const hasTags = protocol || format;
  const latency = edgeData?.simulatedLatency ?? 0;

  const isBroken = isStressMode && isPartitioned;
  const isTimeout = isStressMode && !isPartitioned && latency > stressConfig.latencyThreshold * 3;
  const isSlowEdge = isStressMode && isSlow && !isTimeout;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    setDraft(label);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const event = new CustomEvent("edge-label-change", { detail: { id, label: draft } });
    window.dispatchEvent(event);
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke:
            isBroken || isTimeout
              ? "#ef4444"
              : isSlowEdge
                ? "#f97316"
                : selected
                  ? "#6366f1"
                  : "#6366f180",
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: isBroken ? "8 4" : isTimeout || isSlowEdge ? "6 3" : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="text-xs cursor-pointer"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            startEdit();
          }}
        >
          {isBroken && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] rounded-full mb-1">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              <span className="text-[10px] font-bold text-[#ef4444] tracking-wide">SPLIT</span>
            </div>
          )}
          {isTimeout && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] rounded-full mb-1">
              <span className="text-[10px] font-bold text-[#ef4444] tracking-wide">
                TIMEOUT {latency}ms
              </span>
            </div>
          )}
          {isSlowEdge && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-[rgba(249,115,22,0.15)] border border-[rgba(249,115,22,0.3)] rounded-full mb-1">
              <span className="text-[10px] font-bold text-[#f97316] tracking-wide">
                SLOW {latency}ms
              </span>
            </div>
          )}
          {editing ? (
            <input
              ref={inputRef}
              className="bg-surface-2 border border-accent text-text-bright px-2 py-0.5 rounded text-xs font-sans outline-none w-[120px]"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-[3px]">
              {hasTags && (
                <div className="flex gap-[3px]">
                  {protocol && (
                    <span className="text-[10px] font-semibold px-1.5 py-[1px] rounded-[3px] whitespace-nowrap tracking-[0.02em] bg-[rgba(99,102,241,0.15)] text-[#818cf8] border border-[rgba(99,102,241,0.25)]">
                      {protocol}
                    </span>
                  )}
                  {format && (
                    <span className="text-[10px] font-semibold px-1.5 py-[1px] rounded-[3px] whitespace-nowrap tracking-[0.02em] bg-[rgba(16,185,129,0.15)] text-[#34d399] border border-[rgba(16,185,129,0.25)]">
                      {format}
                    </span>
                  )}
                </div>
              )}
              {label ? (
                <span className="bg-surface-2 border border-border text-text-bright px-2 py-0.5 rounded whitespace-nowrap font-medium">
                  {label}
                </span>
              ) : selected && !hasTags ? (
                <span className="bg-surface-2 border-dashed border-border text-text-dim px-2 py-0.5 rounded whitespace-nowrap italic font-normal">
                  double-click to label
                </span>
              ) : null}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
