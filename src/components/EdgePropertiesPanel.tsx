import type { Edge } from "@xyflow/react";
import type { EdgeData, EdgeProtocol, EdgeFormat } from "../types";
import { EDGE_PROTOCOLS, EDGE_FORMATS } from "../types";
import type { Mode, PanelPosition } from "../App";

interface Props {
  edge: Edge<EdgeData>;
  sourceLabel: string;
  targetLabel: string;
  onUpdate: (id: string, data: Partial<EdgeData>) => void;
  onClose: () => void;
  panelPosition: PanelPosition;
  onTogglePanelPosition: () => void;
  mode: Mode;
  size?: number;
}

export default function EdgePropertiesPanel({
  edge,
  sourceLabel,
  targetLabel,
  onUpdate,
  onClose,
  panelPosition,
  onTogglePanelPosition,
  mode,
  size,
}: Props) {
  const data = edge.data!;

  return (
    <aside
      className={`${panelPosition === "bottom" ? "w-auto min-w-0 h-[260px] min-h-[150px] max-h-[70vh] border-l-0 border-t" : "w-[340px] min-w-[340px] border-l"} bg-surface border-border flex flex-col z-10 overflow-y-auto`}
      style={
        size
          ? panelPosition === "bottom"
            ? { height: size }
            : { width: size, minWidth: size }
          : undefined
      }
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border shrink-0">
        <h2 className="text-base font-bold text-text-bright">Connection</h2>
        <div className="flex items-center gap-1">
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim transition-all duration-150 hover:bg-surface-2 hover:text-text-bright"
            onClick={onTogglePanelPosition}
            title={panelPosition === "right" ? "Dock to bottom" : "Dock to right"}
          >
            {panelPosition === "right" ? (
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
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="15" x2="21" y2="15" />
              </svg>
            ) : (
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
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            )}
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md text-lg text-text-dim transition-all duration-150 hover:bg-surface-2 hover:text-text-bright"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-text-dim">Route</label>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg text-text-dim">
            <span className="text-[13px] font-semibold text-text-bright">{sourceLabel}</span>
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
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <span className="text-[13px] font-semibold text-text-bright">{targetLabel}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-text-dim">Label</label>
          <input
            className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-bright text-sm outline-none transition-[border-color] duration-150 focus:border-accent"
            value={data.label}
            onChange={(e) => onUpdate(edge.id, { label: e.target.value })}
            placeholder="e.g. fetch user data"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-text-dim">Protocol</label>
          <div className="flex flex-wrap gap-1.5">
            {EDGE_PROTOCOLS.map((p) => (
              <button
                key={p}
                className={
                  data.protocol === p
                    ? "px-3 py-[5px] rounded-md text-xs font-semibold bg-accent border border-accent text-white transition-all duration-150 cursor-pointer hover:bg-surface-3 hover:text-text-bright"
                    : "px-3 py-[5px] rounded-md text-xs font-medium bg-surface-2 border border-border text-text transition-all duration-150 cursor-pointer hover:bg-surface-3 hover:text-text-bright"
                }
                onClick={() =>
                  onUpdate(edge.id, { protocol: (data.protocol === p ? "" : p) as EdgeProtocol })
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-text-dim">Format</label>
          <div className="flex flex-wrap gap-1.5">
            {EDGE_FORMATS.map((f) => (
              <button
                key={f}
                className={
                  data.format === f
                    ? "px-3 py-[5px] rounded-md text-xs font-semibold bg-accent border border-accent text-white transition-all duration-150 cursor-pointer hover:bg-surface-3 hover:text-text-bright"
                    : "px-3 py-[5px] rounded-md text-xs font-medium bg-surface-2 border border-border text-text transition-all duration-150 cursor-pointer hover:bg-surface-3 hover:text-text-bright"
                }
                onClick={() =>
                  onUpdate(edge.id, { format: (data.format === f ? "" : f) as EdgeFormat })
                }
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {mode === "stress" && (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-text-dim">Network Partition</label>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-text">
                  {data.partitioned ? "Partitioned" : "Connected"}
                </span>
                <button
                  className={`w-9 h-5 rounded-[10px] border relative cursor-pointer transition-[background,border-color] duration-150 shrink-0${data.partitioned ? " bg-accent border-accent" : " bg-surface-3 border-border"}`}
                  style={
                    data.partitioned
                      ? { background: "#ef4444", borderColor: "#ef4444" }
                      : undefined
                  }
                  onClick={() => onUpdate(edge.id, { partitioned: !data.partitioned })}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 left-0.5 transition-transform duration-150${data.partitioned ? " translate-x-4" : ""}`}
                  />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-text-dim">Simulated Latency</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={100}
                  className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-bright text-sm outline-none transition-[border-color] duration-150 focus:border-accent disabled:opacity-40 disabled:cursor-not-allowed"
                  value={data.simulatedLatency ?? 0}
                  disabled={data.partitioned}
                  onChange={(e) =>
                    onUpdate(edge.id, {
                      simulatedLatency: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
                <span className="text-[13px] text-text-dim shrink-0">ms</span>
              </div>
              {!data.partitioned && (data.simulatedLatency ?? 0) > 0 && (
                <span
                  className={`text-[11px] font-medium ${
                    (data.simulatedLatency ?? 0) > 1500
                      ? "text-[#ef4444]"
                      : (data.simulatedLatency ?? 0) > 500
                        ? "text-[#f97316]"
                        : "text-[#22c55e]"
                  }`}
                >
                  {(data.simulatedLatency ?? 0) > 1500
                    ? `${data.simulatedLatency}ms — effective timeout`
                    : (data.simulatedLatency ?? 0) > 500
                      ? `${data.simulatedLatency}ms — exceeds threshold`
                      : `${data.simulatedLatency}ms — within threshold`}
                </span>
              )}
              {data.partitioned && (
                <span className="text-[11px] text-text-dim">
                  Disabled while edge is partitioned
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
