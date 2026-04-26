import { useState } from "react";
import type { Node } from "@xyflow/react";
import type { SystemNodeData, Endpoint, ResourceLink, EffectiveStress } from "../types";
import type { Mode, PanelPosition } from "../App";
import { displayType } from "../data";
import { registry } from "../registry";
import { ulid } from "ulid";
import ToolLauncher from "../tools/ToolLauncher";

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

const ALL_RESPONSE_CODES = [200, 201, 204, 400, 401, 403, 404, 409, 422, 500, 503];

function defaultResponseCodes(method: string): number[] {
  const base = [200, 400, 401, 403, 404, 500];
  const m = method.toLowerCase();
  if (m === "post" || m === "put") return [...base, 409, 422];
  if (m === "delete") return [...base, 204];
  return base;
}

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
    const ep: Endpoint = {
      id: ulid(),
      method: "GET",
      path: "",
      queryParams: [],
      responseCodes: defaultResponseCodes("GET"),
    };
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

  const METHOD_ORDER: Record<string, number> = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4 };

  function sortEndpoints() {
    const sorted = [...(data.endpoints ?? [])].sort((a, b) => {
      const pathCmp = a.path.localeCompare(b.path);
      if (pathCmp !== 0) return pathCmp;
      return (METHOD_ORDER[a.method] ?? 99) - (METHOD_ORDER[b.method] ?? 99);
    });
    onUpdate(node.id, { endpoints: sorted });
  }

  function addLink() {
    const link: ResourceLink = { id: ulid(), label: "", url: "" };
    onUpdate(node.id, { links: [...(data.links ?? []), link] });
  }

  function updateLink(id: string, partial: Partial<ResourceLink>) {
    onUpdate(node.id, {
      links: (data.links ?? []).map((l) => (l.id === id ? { ...l, ...partial } : l)),
    });
  }

  function deleteLink(id: string) {
    onUpdate(node.id, {
      links: (data.links ?? []).filter((l) => l.id !== id),
    });
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

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-text-dim">Description</label>
          <textarea
            className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-bright text-sm outline-none transition-[border-color] duration-150 focus:border-accent resize-y min-h-[80px]"
            rows={4}
            placeholder="Describe this component..."
            value={data.description ?? ""}
            onChange={(e) => onUpdate(node.id, { description: e.target.value })}
          />
        </div>

        {mode === "stress" && (
          <>
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
                  onChange={(e) => onUpdate(node.id, { capacityPercent: Number(e.target.value) })}
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
                <label className="text-[13px] font-semibold text-text-dim">Queue Simulation</label>
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
                          stressEffect.status === "error" ? "text-[#ef4444]" : "text-[#eab308]"
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

        {mode === "plan" && <ToolLauncher componentType={data.componentType} />}

        {mode === "plan" && data.componentType === "api-gateway" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-semibold text-text-dim">Endpoints</label>
              <div className="flex items-center gap-1">
                <button
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-text-dim bg-transparent transition-all duration-150 hover:bg-surface-2 hover:text-text-bright"
                  onClick={sortEndpoints}
                  title="Sort by path, then method"
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
                    <path d="M3 6h18M3 12h12M3 18h6" />
                  </svg>
                  Sort
                </button>
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
                      className="flex flex-col gap-2 px-2.5 py-2 bg-surface border-accent rounded-lg transition-[border-color] duration-150 border"
                    >
                      {/* Method + Path row */}
                      <div className="flex items-center gap-2">
                        <select
                          className="text-[11px] font-bold px-1 py-[3px] rounded bg-surface-2 border border-border text-text-bright outline-none cursor-pointer shrink-0"
                          value={ep.method}
                          onChange={(e) => {
                            const method = e.target.value;
                            const update: Partial<Endpoint> = { method };
                            if (!ep.responseCodes || ep.responseCodes.length === 0) {
                              update.responseCodes = defaultResponseCodes(method);
                            }
                            updateEndpoint(ep.id, update);
                          }}
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
                          onChange={(e) => {
                            const val = e.target.value;
                            const match = val.match(/^(GET|POST|PUT|PATCH|DELETE)\s+/i);
                            if (match) {
                              updateEndpoint(ep.id, {
                                method: match[1].toUpperCase(),
                                path: val.slice(match[0].length),
                              });
                            } else {
                              updateEndpoint(ep.id, { path: val });
                            }
                          }}
                          placeholder="/api/v1/resource"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addEndpoint();
                            } else if (e.key === "Escape") {
                              if (!ep.path.trim()) {
                                deleteEndpoint(ep.id);
                              } else {
                                setEditingEndpointId(null);
                              }
                            }
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

                      {/* Query Params */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-text-dim uppercase tracking-wide">
                            Query Params
                          </span>
                          <button
                            className="text-[10px] text-accent hover:text-text-bright transition-colors duration-150"
                            onClick={() => {
                              const params = [
                                ...(ep.queryParams ?? []),
                                { name: "", required: false },
                              ];
                              updateEndpoint(ep.id, { queryParams: params });
                            }}
                          >
                            + Param
                          </button>
                        </div>
                        {(ep.queryParams ?? []).map((qp, qi) => (
                          <div key={qi} className="flex items-center gap-1.5">
                            <input
                              className="flex-1 text-[12px] font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-bright outline-none min-w-0 focus:border-accent"
                              value={qp.name}
                              placeholder="param"
                              onChange={(e) => {
                                const params = [...(ep.queryParams ?? [])];
                                params[qi] = { ...params[qi], name: e.target.value };
                                updateEndpoint(ep.id, { queryParams: params });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const params = [
                                    ...(ep.queryParams ?? []),
                                    { name: "", required: false },
                                  ];
                                  updateEndpoint(ep.id, { queryParams: params });
                                } else if (e.key === "Escape" && !qp.name.trim()) {
                                  const params = (ep.queryParams ?? []).filter((_, i) => i !== qi);
                                  updateEndpoint(ep.id, { queryParams: params });
                                }
                              }}
                            />
                            <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                              <input
                                type="checkbox"
                                className="cursor-pointer"
                                checked={qp.required}
                                onChange={(e) => {
                                  const params = [...(ep.queryParams ?? [])];
                                  params[qi] = { ...params[qi], required: e.target.checked };
                                  updateEndpoint(ep.id, { queryParams: params });
                                }}
                              />
                              <span className="text-[10px] text-text-dim">req</span>
                            </label>
                            <button
                              className="flex items-center justify-center w-[18px] h-[18px] rounded text-text-dim transition-all duration-150 hover:bg-[rgba(239,68,68,0.15)] hover:text-[#ef4444] shrink-0"
                              onClick={() => {
                                const params = (ep.queryParams ?? []).filter((_, i) => i !== qi);
                                updateEndpoint(ep.id, { queryParams: params });
                              }}
                            >
                              <svg
                                width="10"
                                height="10"
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
                        ))}
                      </div>

                      {/* Response Codes */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold text-text-dim uppercase tracking-wide">
                          Response Codes
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {ALL_RESPONSE_CODES.map((code) => {
                            const codes = ep.responseCodes ?? defaultResponseCodes(ep.method);
                            const active = codes.includes(code);
                            return (
                              <button
                                key={code}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-all duration-150 border ${active ? "bg-accent/20 border-accent text-accent" : "bg-surface-2 border-border text-text-dim hover:text-text"}`}
                                onClick={() => {
                                  const current =
                                    ep.responseCodes ?? defaultResponseCodes(ep.method);
                                  const next = active
                                    ? current.filter((c) => c !== code)
                                    : [...current, code].sort((a, b) => a - b);
                                  updateEndpoint(ep.id, { responseCodes: next });
                                }}
                              >
                                {code}
                              </button>
                            );
                          })}
                        </div>
                      </div>
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
                      <span className="flex-1 flex items-center gap-1 min-w-0">
                        <span className="text-[13px] text-text-bright font-mono whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
                          {ep.path || "/..."}
                        </span>
                        {(ep.queryParams?.filter((q) => q.name.trim()).length ?? 0) > 0 && (
                          <span className="text-[10px] text-text-dim font-mono shrink-0">
                            ?{ep.queryParams!.filter((q) => q.name.trim()).length}
                          </span>
                        )}
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

        {mode === "plan" &&
          (data.componentType === "service" || data.componentType === "serverless") && (
            <DeployFields node={node} onUpdate={onUpdate} />
          )}

        {mode === "plan" && (
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
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-semibold text-text-dim">Links</label>
            <button
              className="text-[11px] text-accent font-medium transition-colors duration-150 hover:text-text-bright"
              onClick={addLink}
            >
              + Add
            </button>
          </div>
          {(data.links ?? []).length > 0 && (
            <div className="flex flex-col gap-1.5">
              {(data.links ?? []).map((link) => (
                <div
                  key={link.id}
                  className="bg-surface-2 border border-border rounded-lg px-3 py-2 flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      className="flex-1 bg-transparent border-none outline-none text-[13px] text-text-bright placeholder:text-text-dim min-w-0"
                      value={link.label}
                      onChange={(e) => updateLink(link.id, { label: e.target.value })}
                      placeholder="Label"
                    />
                    <button
                      className="w-5 h-5 flex items-center justify-center rounded text-text-dim shrink-0 transition-colors duration-150 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.12)]"
                      onClick={() => deleteLink(link.id)}
                      title="Remove link"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      className="flex-1 bg-transparent border-none outline-none text-[12px] text-text-dim placeholder:text-text-dim min-w-0 font-mono"
                      value={link.url}
                      onChange={(e) => updateLink(link.id, { url: e.target.value })}
                      placeholder="https://..."
                    />
                    {link.url && (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-5 h-5 flex items-center justify-center rounded text-text-dim shrink-0 transition-colors duration-150 hover:text-accent hover:bg-accent-bg"
                        title="Open link"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

interface DeployFieldsProps {
  node: Node<SystemNodeData>;
  onUpdate: (id: string, data: Partial<SystemNodeData>) => void;
}

function DeployFields({ node, onUpdate }: DeployFieldsProps) {
  const { data } = node;
  const envEntries = Object.entries(data.env ?? {});

  function updateEnvKey(idx: number, newKey: string) {
    const next: Record<string, string> = {};
    envEntries.forEach(([k, v], i) => {
      next[i === idx ? newKey : k] = v;
    });
    onUpdate(node.id, { env: next });
  }

  function updateEnvValue(idx: number, newValue: string) {
    const next: Record<string, string> = {};
    envEntries.forEach(([k, v], i) => {
      next[k] = i === idx ? newValue : v;
    });
    onUpdate(node.id, { env: next });
  }

  function addEnv() {
    onUpdate(node.id, { env: { ...data.env, "": "" } });
  }

  function removeEnv(idx: number) {
    const next: Record<string, string> = {};
    envEntries.forEach(([k, v], i) => {
      if (i !== idx) next[k] = v;
    });
    onUpdate(node.id, { env: next });
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[13px] font-semibold text-text-dim">Deploy</label>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-dim">Image</label>
        <input
          className="bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-text-bright text-[13px] font-mono outline-none focus:border-accent placeholder:text-text-dim placeholder:italic"
          value={data.image ?? ""}
          onChange={(e) => onUpdate(node.id, { image: e.target.value || undefined })}
          placeholder="mycompany/api:v3"
        />
      </div>
      <div className="flex flex-col gap-1 mt-2">
        <label className="text-xs font-medium text-text-dim">Build context</label>
        <input
          className="bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-text-bright text-[13px] font-mono outline-none focus:border-accent placeholder:text-text-dim placeholder:italic"
          value={data.buildContext ?? ""}
          onChange={(e) => onUpdate(node.id, { buildContext: e.target.value || undefined })}
          placeholder="./services/api"
        />
        <span className="text-[11px] text-text-dim">
          Leave both empty to scaffold a hello-world server in the chosen runtime.
        </span>
      </div>
      <div className="flex flex-col gap-1 mt-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text-dim">Env overrides</label>
          <button
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-accent transition-all duration-150 hover:bg-accent-bg"
            onClick={addEnv}
          >
            + Add
          </button>
        </div>
        {envEntries.length === 0 ? (
          <span className="text-[11px] text-text-dim italic">
            None — exporter will inject defaults from connected nodes.
          </span>
        ) : (
          <div className="flex flex-col gap-1">
            {envEntries.map(([k, v], i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  className="flex-1 min-w-0 bg-surface-2 border border-border rounded-md px-2 py-1 text-text-bright text-[12px] font-mono outline-none focus:border-accent"
                  value={k}
                  onChange={(e) => updateEnvKey(i, e.target.value)}
                  placeholder="KEY"
                />
                <span className="text-text-dim text-[11px]">=</span>
                <input
                  className="flex-1 min-w-0 bg-surface-2 border border-border rounded-md px-2 py-1 text-text-bright text-[12px] font-mono outline-none focus:border-accent"
                  value={v}
                  onChange={(e) => updateEnvValue(i, e.target.value)}
                  placeholder="value"
                />
                <button
                  className="flex items-center justify-center w-[22px] h-[22px] rounded text-text-dim transition-all duration-150 hover:bg-surface-3 hover:text-text-bright"
                  onClick={() => removeEnv(i)}
                  title="Remove"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
