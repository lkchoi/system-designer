import { Handle, Position, useReactFlow, NodeResizer } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import type { SystemNodeData } from "../types";
import { registry, PRICING } from "../registry";
import { useMode, useStress } from "../App";

const STATUS_COLORS: Record<string, string> = {
  healthy: "#22c55e",
  warning: "#eab308",
  error: "#ef4444",
  idle: "#6b7280",
};

type SystemNode = Node<SystemNodeData, "system">;

export default function SystemNode({ id, data, selected }: NodeProps<SystemNode>) {
  const { deleteElements } = useReactFlow();
  const mode = useMode();
  const { effects } = useStress();
  const def = registry.getOrDefault(data.componentType);

  const isStressMode = mode === "stress";
  const stressEffect = effects.get(id);
  const failureState = data.stressFailure || "none";
  const displayStatus = isStressMode && stressEffect ? stressEffect.status : data.status;

  const baseClasses =
    "bg-surface border border-border rounded-xl px-4 pt-3.5 pb-2.5 min-w-[180px] w-full h-full transition-[border-color,box-shadow] duration-150 box-border overflow-hidden";

  const selectedClasses = selected
    ? " border-accent shadow-[0_0_0_1px_var(--color-accent),0_0_20px_rgba(99,102,241,0.15)]"
    : "";

  const stressClasses = isStressMode
    ? failureState === "down"
      ? " border-[#ef4444] shadow-[0_0_0_1px_#ef4444,0_0_16px_rgba(239,68,68,0.25)] opacity-70 relative"
      : failureState === "overloaded"
        ? " border-[#eab308] shadow-[0_0_0_1px_#eab308,0_0_16px_rgba(234,179,8,0.2)] animate-[stress-pulse_2s_ease-in-out_infinite]"
        : stressEffect?.reason === "cascade"
          ? " border-dashed border-[#eab308]"
          : stressEffect?.reason === "partition-cp"
            ? " border-dashed border-[#ef4444]"
            : stressEffect?.reason === "partition-ap"
              ? " border-dashed border-[#eab308]"
              : ""
    : "";

  return (
    <>
      {selected && (
        <NodeResizer
          minWidth={180}
          minHeight={100}
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
      <div className={`${baseClasses}${selectedClasses}${stressClasses}`}>
        <div className="flex items-center gap-2 mb-2.5">
          <div
            className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0"
            style={{ background: def.color }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={def.icon} />
            </svg>
          </div>
          <span className="flex-1 text-sm font-semibold text-text-bright whitespace-nowrap overflow-hidden text-ellipsis">
            {data.label}
          </span>
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: STATUS_COLORS[displayStatus] }}
          />
        </div>
        {isStressMode && data.capClassification && (
          <div
            className={`inline-flex items-center px-2 py-0.5 mb-2 rounded-full text-[11px] font-bold tracking-wide${
              data.capClassification.toLowerCase() === "cp"
                ? " bg-[rgba(99,102,241,0.15)] text-[#818cf8] border border-[rgba(99,102,241,0.25)]"
                : data.capClassification.toLowerCase() === "ap"
                  ? " bg-[rgba(34,197,94,0.15)] text-[#22c55e] border border-[rgba(34,197,94,0.25)]"
                  : data.capClassification.toLowerCase() === "ca"
                    ? " bg-[rgba(234,179,8,0.15)] text-[#eab308] border border-[rgba(234,179,8,0.25)]"
                    : ""
            }`}
          >
            {data.capClassification}
          </div>
        )}
        {data.sharded && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 mb-2 bg-accent-bg border border-[rgba(99,102,241,0.25)] rounded-full text-[11px] text-accent font-medium max-w-full overflow-hidden">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
            <span className="whitespace-nowrap overflow-hidden text-ellipsis">
              {data.shardKey || "Sharded"}
            </span>
          </div>
        )}
        {mode === "price" ? (
          (() => {
            const techName = data.plan?.technology;
            const pricing = techName ? PRICING[techName] : undefined;
            return (
              <div className="flex items-center gap-1.5 mb-2.5">
                {pricing ? (
                  <>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                    >
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                    </svg>
                    <span className="text-xs text-[#22c55e] font-semibold font-mono whitespace-nowrap overflow-hidden text-ellipsis">
                      {pricing.tiers[0]?.price}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-text-dim italic">
                    {techName ? "No pricing data" : "Set tech in Plan mode"}
                  </span>
                )}
              </div>
            );
          })()
        ) : mode !== "plan" ? (
          <div className="flex gap-4 mb-2.5">
            <div className="flex gap-2 text-xs text-text-dim">
              <span>CPU</span>
              <span className="text-text-bright font-semibold font-mono">{data.metrics.cpu}%</span>
            </div>
            <div className="flex gap-2 text-xs text-text-dim">
              <span>Memory</span>
              <span className="text-text-bright font-semibold font-mono">
                {data.metrics.memory}%
              </span>
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-2 border-t border-border pt-2">
          <button
            className="flex items-center gap-[5px] px-2 py-1 rounded-md text-xs text-accent transition-all duration-150 hover:bg-accent-bg hover:text-text-bright"
            onPointerDown={(e) => e.stopPropagation()}
            title="Drag from handles to connect"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            <span>Connect</span>
          </button>
          <button
            className="flex items-center gap-[5px] px-2 py-1 rounded-md text-xs text-text-dim transition-all duration-150 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.12)] ml-auto"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => deleteElements({ nodes: [{ id }] })}
            title="Delete node"
          >
            <svg
              width="14"
              height="14"
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
        {isStressMode && failureState === "down" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(239,68,68,0.08)] rounded-xl pointer-events-none text-[11px] font-bold tracking-widest text-[#ef4444]">
            OFFLINE
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="right" className="system-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="system-handle" />
    </>
  );
}
