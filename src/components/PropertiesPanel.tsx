import { useState } from "react";
import type { Node } from "@xyflow/react";
import type {
  SystemNodeData,
  NodeStatus,
  Endpoint,
  CAPClassification,
  EffectiveStress,
} from "../types";
import type { Mode, PanelPosition } from "../App";
import { displayType } from "../data";
import { registry, PRICING } from "../registry";
import { ulid } from "ulid";

const STATUSES: NodeStatus[] = ["healthy", "warning", "error", "idle"];

const STATUS_COLORS: Record<string, string> = {
  healthy: "#22c55e",
  warning: "#eab308",
  error: "#ef4444",
  idle: "#6b7280",
};

interface Props {
  node: Node<SystemNodeData>;
  mode: Mode;
  onUpdate: (id: string, data: Partial<SystemNodeData>) => void;
  onClose: () => void;
  panelPosition: PanelPosition;
  onTogglePanelPosition: () => void;
  stressEffect?: EffectiveStress;
  size?: number;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const METHOD_COLORS: Record<string, string> = {
  get: "text-[#22c55e] bg-[rgba(34,197,94,0.12)]",
  post: "text-[#3b82f6] bg-[rgba(59,130,246,0.12)]",
  put: "text-[#f97316] bg-[rgba(249,115,22,0.12)]",
  patch: "text-[#eab308] bg-[rgba(234,179,8,0.12)]",
  delete: "text-[#ef4444] bg-[rgba(239,68,68,0.12)]",
};

const STRESS_STATE_COLORS: Record<string, string> = {
  none: "bg-[rgba(34,197,94,0.12)] text-[#22c55e]",
  overloaded: "bg-[rgba(234,179,8,0.12)] text-[#eab308]",
  down: "bg-[rgba(239,68,68,0.12)] text-[#ef4444]",
};

export default function PropertiesPanel({
  node,
  mode,
  onUpdate,
  onClose,
  panelPosition,
  onTogglePanelPosition,
  stressEffect,
  size,
}: Props) {
  const { data } = node;
  const entry = registry.getOrDefault(data.componentType);
  const planFields = entry.planFields;
  const [editingEndpointId, setEditingEndpointId] = useState<string | null>(null);

  function updatePlanField(key: string, value: string) {
    onUpdate(node.id, { plan: { ...data.plan, [key]: value } });
  }

  function addEndpoint() {
    const ep: Endpoint = { id: ulid(), method: "GET", path: "" };
    onUpdate(node.id, { endpoints: [...(data.endpoints ?? []), ep] });
    setEditingEndpointId(ep.id);
  }

  function updateEndpoint(id: string, partial: Partial<Endpoint>) {
    onUpdate(node.id, {
      endpoints: (data.endpoints ?? []).map((ep) => (ep.id === id ? { ...ep, ...partial } : ep)),
    });
  }

  function deleteEndpoint(id: string) {
    onUpdate(node.id, {
      endpoints: (data.endpoints ?? []).filter((ep) => ep.id !== id),
    });
    if (editingEndpointId === id) setEditingEndpointId(null);
  }

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
        <h2 className="text-base font-bold text-text-bright">Properties</h2>
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
          <label className="text-[13px] font-semibold text-text-dim">Label</label>
          <input
            className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-bright text-sm outline-none transition-[border-color] duration-150 focus:border-accent"
            value={data.label}
            onChange={(e) => onUpdate(node.id, { label: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-text-dim">Type</label>
          <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-bright text-sm">
            {displayType(data.componentType)}
          </div>
        </div>

        {mode === "monitor" && (
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold text-text-dim">Status</label>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  className={`px-3 py-[7px] rounded-lg bg-surface-2 border border-border text-[13px] font-medium transition-all duration-150 text-center hover:bg-surface-3 hover:text-text-bright${data.status === s ? " text-text-bright font-semibold" : " text-text"}`}
                  style={
                    data.status === s
                      ? { borderColor: STATUS_COLORS[s], background: STATUS_COLORS[s] + "22" }
                      : undefined
                  }
                  onClick={() => onUpdate(node.id, { status: s })}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "stress" && (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-text-dim">CAP Classification</label>
              <div className="flex flex-col gap-1">
                {(["CP", "AP", "CA"] as CAPClassification[]).map((cap) => (
                  <button
                    key={cap}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-2 border text-left transition-all duration-150 cursor-pointer hover:bg-surface-3${data.capClassification === cap ? " border-accent bg-accent-bg" : " border-border"}`}
                    onClick={() =>
                      onUpdate(node.id, {
                        capClassification: data.capClassification === cap ? "" : cap,
                      })
                    }
                  >
                    <span className="text-sm font-bold text-text-bright min-w-6">{cap}</span>
                    <span className="text-xs text-text-dim">
                      {cap === "CP"
                        ? "Consistent + Partition tolerant"
                        : cap === "AP"
                          ? "Available + Partition tolerant"
                          : "Consistent + Available"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-dim leading-normal mt-1">
                {data.capClassification === "CP"
                  ? "Sacrifices availability during partitions — will become unavailable."
                  : data.capClassification === "AP"
                    ? "Sacrifices consistency during partitions — will serve stale data."
                    : data.capClassification === "CA"
                      ? "No partition tolerance — only works as single node."
                      : "How does this node behave during network partitions?"}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-text-dim">Failure State</label>
              <div
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[13px] font-bold tracking-wide ${STRESS_STATE_COLORS[data.stressFailure || "none"]}`}
              >
                {data.stressFailure === "down"
                  ? "DOWN"
                  : data.stressFailure === "overloaded"
                    ? "OVERLOADED"
                    : "HEALTHY"}
              </div>
              <span className="text-[11px] text-text-dim mt-1">
                Click node on canvas to cycle state
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-text-dim">Capacity</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={data.capacityPercent ?? 100}
                  disabled={data.stressFailure === "down"}
                  onChange={(e) =>
                    onUpdate(node.id, { capacityPercent: Number(e.target.value) })
                  }
                  className="flex-1 accent-accent disabled:opacity-40"
                />
                <span className="text-sm font-bold text-text-bright tabular-nums w-10 text-right">
                  {data.stressFailure === "down" ? 0 : (data.capacityPercent ?? 100)}%
                </span>
              </div>
              <span
                className={`text-[11px] font-medium ${
                  data.stressFailure === "down" || (data.capacityPercent ?? 100) < 20
                    ? "text-[#ef4444]"
                    : (data.capacityPercent ?? 100) < 50
                      ? "text-[#eab308]"
                      : "text-[#22c55e]"
                }`}
              >
                {data.stressFailure === "down"
                  ? "Offline — node is down"
                  : (data.capacityPercent ?? 100) < 20
                    ? "Critical"
                    : (data.capacityPercent ?? 100) < 50
                      ? "Degraded"
                      : "Operational"}
              </span>
            </div>
            {(data.componentType === "message-queue" ||
              data.componentType === "stream-processor") && (
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-text-dim">
                  Queue Simulation
                </label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-text-dim">Consumer Rate</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        className="w-20 bg-surface-2 border border-border rounded-md px-2 py-1 text-text-bright text-xs outline-none transition-[border-color] duration-150 focus:border-accent text-right"
                        value={data.consumerRate ?? 1000}
                        onChange={(e) =>
                          onUpdate(node.id, {
                            consumerRate: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                      <span className="text-[11px] text-text-dim">msg/s</span>
                    </div>
                  </div>
                  {stressEffect?.queueDepth != null && stressEffect.queueDepth > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-surface-2 border border-border rounded-lg">
                      <span className="text-[12px] text-text-dim">Queue Depth</span>
                      <span
                        className={`text-[13px] font-bold tabular-nums ${
                          stressEffect.status === "error"
                            ? "text-[#ef4444]"
                            : "text-[#eab308]"
                        }`}
                      >
                        ~{stressEffect.queueDepth.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {stressEffect &&
              stressEffect.reason !== "healthy" &&
              stressEffect.reason !== "direct" && (
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-text-dim">
                    {stressEffect.reason === "cascade"
                      ? "Cascade Effect"
                      : stressEffect.reason === "backpressure"
                        ? "Backpressure"
                        : stressEffect.reason === "traffic-spike"
                          ? "Traffic Spike"
                          : stressEffect.reason === "slow-edge"
                            ? "Slow Dependency"
                            : stressEffect.reason === "capacity"
                              ? "Capacity"
                              : "Effect"}
                  </label>
                  <div
                    className={`text-[13px] rounded-lg px-3 py-2 leading-snug ${
                      stressEffect.status === "error"
                        ? "text-[#ef4444] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)]"
                        : "text-[#eab308] bg-[rgba(234,179,8,0.08)] border border-[rgba(234,179,8,0.2)]"
                    }`}
                  >
                    {stressEffect.explanation}
                  </div>
                  {stressEffect.effectiveCapacity != null &&
                    stressEffect.effectiveCapacity < 100 && (
                      <span className="text-[11px] text-text-dim">
                        Effective capacity: {stressEffect.effectiveCapacity}%
                      </span>
                    )}
                </div>
              )}
          </>
        )}

        {mode === "plan" && data.componentType === "api-gateway" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-semibold text-text-dim">Endpoints</label>
              <button
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-accent bg-transparent transition-all duration-150 hover:bg-accent-bg"
                onClick={addEndpoint}
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
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add
              </button>
            </div>
            {(data.endpoints ?? []).length === 0 ? (
              <div className="text-xs text-text-dim p-3 text-center bg-surface-2 border border-dashed border-border rounded-lg mt-1">
                No endpoints defined
              </div>
            ) : (
              <div className="flex flex-col gap-1 mt-1">
                {(data.endpoints ?? []).map((ep) =>
                  editingEndpointId === ep.id ? (
                    <div
                      key={ep.id}
                      className="group flex items-center gap-2 px-2.5 py-1.5 bg-surface border-accent rounded-lg transition-[border-color] duration-150 border"
                    >
                      <select
                        className="text-[11px] font-bold px-1 py-[3px] rounded bg-surface-2 border border-border text-text-bright outline-none cursor-pointer shrink-0"
                        value={ep.method}
                        onChange={(e) => updateEndpoint(ep.id, { method: e.target.value })}
                      >
                        {HTTP_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <input
                        className="flex-1 text-[13px] font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-bright outline-none min-w-0 focus:border-accent"
                        value={ep.path}
                        onChange={(e) => updateEndpoint(ep.id, { path: e.target.value })}
                        placeholder="/api/v1/resource"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Escape") setEditingEndpointId(null);
                        }}
                      />
                      <button
                        className="flex items-center justify-center w-[22px] h-[22px] rounded text-text-dim transition-all duration-150 hover:bg-surface-3 hover:text-text-bright"
                        onClick={() => setEditingEndpointId(null)}
                        title="Done"
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
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div
                      key={ep.id}
                      className="group flex items-center gap-2 px-2.5 py-1.5 bg-surface-2 border border-border rounded-lg transition-[border-color] duration-150 hover:border-surface-3"
                    >
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0 font-mono uppercase ${METHOD_COLORS[ep.method.toLowerCase()] ?? ""}`}
                      >
                        {ep.method}
                      </span>
                      <span className="flex-1 text-[13px] text-text-bright font-mono whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
                        {ep.path || "/..."}
                      </span>
                      <div className="flex gap-0.5 opacity-0 transition-opacity duration-150 shrink-0 group-hover:opacity-100">
                        <button
                          className="flex items-center justify-center w-[22px] h-[22px] rounded text-text-dim transition-all duration-150 hover:bg-surface-3 hover:text-text-bright"
                          onClick={() => setEditingEndpointId(ep.id)}
                          title="Edit"
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
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="flex items-center justify-center w-[22px] h-[22px] rounded text-text-dim transition-all duration-150 hover:bg-[rgba(239,68,68,0.15)] hover:text-[#ef4444]"
                          onClick={() => deleteEndpoint(ep.id)}
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
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        )}

        {mode === "plan" ? (
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold text-text-dim">Plan</label>
            {planFields.map((field, i) => (
              <div key={field.key} className={`flex flex-col gap-1${i > 0 ? " mt-2" : ""}`}>
                <label className="text-xs font-medium text-text-dim">{field.label}</label>
                {field.type === "technology" ? (
                  <>
                    <select
                      className="plan-field-select"
                      value={data.plan?.[field.key] ?? ""}
                      onChange={(e) => updatePlanField(field.key, e.target.value)}
                    >
                      <option value="">Select a technology...</option>
                      {entry.technologies.map((tech) => (
                        <option key={tech.name} value={tech.name}>
                          {tech.name}
                        </option>
                      ))}
                    </select>
                    {data.plan?.[field.key] &&
                      (() => {
                        const tech = entry.technologies.find(
                          (t) => t.name === data.plan[field.key],
                        );
                        if (!tech) return null;
                        return (
                          <div className="bg-surface-2 border border-border rounded-lg p-2.5 mt-1.5 flex flex-col gap-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                                Purpose
                              </span>
                              <span className="text-xs text-text leading-snug">{tech.purpose}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                                Throughput
                              </span>
                              <span className="text-xs text-text leading-snug">
                                {tech.throughput}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                                Limits
                              </span>
                              <span className="text-xs text-text leading-snug">{tech.limits}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                                Providers
                              </span>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {tech.providers.map((p) => (
                                  <span
                                    key={p}
                                    className="text-[11px] px-[7px] py-0.5 bg-accent-bg text-accent rounded font-medium whitespace-nowrap"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                  </>
                ) : (
                  <textarea
                    className="bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-text-bright text-[13px] font-sans outline-none resize-y min-h-7 transition-[border-color] duration-150 focus:border-accent placeholder:text-text-dim placeholder:italic"
                    value={data.plan?.[field.key] ?? ""}
                    onChange={(e) => updatePlanField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={1}
                  />
                )}
              </div>
            ))}
          </div>
        ) : mode === "price" ? (
          (() => {
            const techName = data.plan?.technology;
            const pricing = techName ? PRICING[techName] : undefined;
            return (
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-text-dim">Pricing</label>
                {!techName ? (
                  <div className="text-xs text-text-dim p-3 text-center bg-surface-2 border border-dashed border-border rounded-lg">
                    Select a technology in Plan mode to see pricing
                  </div>
                ) : !pricing ? (
                  <div className="text-xs text-text-dim p-3 text-center bg-surface-2 border border-dashed border-border rounded-lg">
                    No pricing data for {techName}
                  </div>
                ) : (
                  <>
                    <div className="bg-surface-2 border border-border rounded-lg p-2.5 flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                        Billing Model
                      </span>
                      <span className="text-xs text-text leading-snug">{pricing.model}</span>
                    </div>
                    <div className="bg-surface-2 border border-border rounded-lg p-2.5 flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                        Unit
                      </span>
                      <span className="text-xs text-text leading-snug">{pricing.unit}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                        Price Tiers
                      </span>
                      {pricing.tiers.map((tier) => (
                        <div
                          key={tier.name}
                          className="bg-surface-2 border border-border rounded-lg px-2.5 py-2 flex flex-col gap-0.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-text-bright">
                              {tier.name}
                            </span>
                            <span className="text-xs font-semibold font-mono text-[#22c55e] whitespace-nowrap">
                              {tier.price}
                            </span>
                          </div>
                          {tier.description && (
                            <span className="text-[11px] text-text-dim leading-snug">
                              {tier.description}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {pricing.freeTier && (
                      <div className="bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] rounded-lg p-2.5 flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#22c55e]">
                          Free Tier
                        </span>
                        <span className="text-xs text-text leading-snug">{pricing.freeTier}</span>
                      </div>
                    )}
                    {pricing.modes && pricing.modes.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                          Pricing Modes
                        </span>
                        {pricing.modes.map((m) => (
                          <div
                            key={m.name}
                            className="bg-surface-2 border border-border rounded-lg px-2.5 py-2 flex flex-col gap-0.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-text-bright">{m.name}</span>
                              <span className="text-[11px] font-mono text-accent whitespace-nowrap">
                                {m.priceImpact}
                              </span>
                            </div>
                            <span className="text-[11px] text-text-dim leading-snug">
                              {m.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold text-text-dim">Metrics</label>

            <div className="flex flex-col gap-2">
              <div className="bg-surface-2 border border-border rounded-[10px] p-3">
                <div className="flex items-center gap-2 text-xs text-text-dim mb-1.5">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ background: entry.color + "33", color: entry.color }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                  </div>
                  <span>CPU Usage</span>
                </div>
                <div className="text-[28px] font-bold text-text-bright font-mono leading-tight mb-1">
                  {data.metrics.cpu} <span className="text-sm font-normal text-text-dim">%</span>
                </div>
                <div className="h-1.5 bg-surface-3 rounded-[3px] overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-[3px] transition-[width] duration-300 ease-out bg-gradient-to-r from-[#6366f1] to-[#818cf8]"
                    style={{ width: `${data.metrics.cpu}%` }}
                  />
                </div>
              </div>

              <div className="bg-surface-2 border border-border rounded-[10px] p-3">
                <div className="flex items-center gap-2 text-xs text-text-dim mb-1.5">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ background: "#ec489933", color: "#ec4899" }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <path d="M6 12h4m4 0h4" />
                    </svg>
                  </div>
                  <span>Memory Usage</span>
                </div>
                <div className="text-[28px] font-bold text-text-bright font-mono leading-tight mb-1">
                  {data.metrics.memory} <span className="text-sm font-normal text-text-dim">%</span>
                </div>
                <div className="h-1.5 bg-surface-3 rounded-[3px] overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-[3px] transition-[width] duration-300 ease-out bg-gradient-to-r from-[#ec4899] to-[#f472b6]"
                    style={{ width: `${data.metrics.memory}%` }}
                  />
                </div>
              </div>

              <div className="bg-surface-2 border border-border rounded-[10px] p-3">
                <div className="flex items-center gap-2 text-xs text-text-dim mb-1.5">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ background: "#eab30833", color: "#eab308" }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </div>
                  <span>Requests/sec</span>
                </div>
                <div className="text-[28px] font-bold text-text-bright font-mono leading-tight mb-1">
                  {data.metrics.requestsPerSec}{" "}
                  <span className="text-sm font-normal text-text-dim">req/s</span>
                </div>
              </div>

              <div className="bg-surface-2 border border-border rounded-[10px] p-3">
                <div className="flex items-center gap-2 text-xs text-text-dim mb-1.5">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ background: "#6366f133", color: "#6366f1" }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                  <span>Latency</span>
                </div>
                <div className="text-[28px] font-bold text-text-bright font-mono leading-tight mb-1">
                  {data.metrics.latency}{" "}
                  <span className="text-sm font-normal text-text-dim">ms</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === "plan" && (
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold text-text-dim">Sharding</label>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text">
                {data.sharded ? "Sharded" : "Not Sharded"}
              </span>
              <button
                className={`w-9 h-5 rounded-[10px] border relative cursor-pointer transition-[background,border-color] duration-150 shrink-0${data.sharded ? " bg-accent border-accent" : " bg-surface-3 border-border"}`}
                onClick={() =>
                  onUpdate(node.id, {
                    sharded: !data.sharded,
                    ...(!data.sharded ? {} : { shardKey: "" }),
                  })
                }
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 left-0.5 transition-transform duration-150${data.sharded ? " translate-x-4" : ""}`}
                />
              </button>
            </div>
            {data.sharded && (
              <div className="flex flex-col gap-1" style={{ marginTop: 8 }}>
                <label className="text-xs font-medium text-text-dim">Shard Key</label>
                <input
                  className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-bright text-sm outline-none transition-[border-color] duration-150 focus:border-accent"
                  value={data.shardKey}
                  onChange={(e) => onUpdate(node.id, { shardKey: e.target.value })}
                  placeholder="e.g. user_id, tenant_id"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-text-dim">Position</label>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 flex flex-col gap-0.5">
              <span className="text-xs text-text-dim">X</span>
              <span className="text-base font-bold text-text-bright font-mono">
                {Math.round(node.position.x)}
              </span>
            </div>
            <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 flex flex-col gap-0.5">
              <span className="text-xs text-text-dim">Y</span>
              <span className="text-base font-bold text-text-bright font-mono">
                {Math.round(node.position.y)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
