import { useState, type RefObject, type MutableRefObject } from "react";
import { registry } from "../registry";
import { BUILTIN_PATTERNS } from "../patterns";
import type { SavedFlow } from "../types";

const ANNOTATION_ITEMS = [
  {
    type: "sticky",
    label: "Sticky Note",
    bg: "#fde68a",
    stroke: "#92400e",
    icon: "M15.5 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.5L15.5 3zM14 3v5h7",
  },
  {
    type: "text",
    label: "Text",
    bg: "var(--surface-3)",
    stroke: "#9ca3af",
    icon: "M4 7V4h16v3M9 20h6M12 4v16",
  },
  {
    type: "container",
    label: "Container",
    bg: "var(--surface-3)",
    stroke: "#9ca3af",
    icon: "M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM3 9h18M9 21V9",
  },
];

interface SidebarProps {
  savedFlows: SavedFlow[];
  activeFlowId: string | null;
  onLoadFlow: (flow: SavedFlow) => void;
  onDeleteFlow: (id: string) => void;
  getNodeLabel: (id: string) => string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  width?: number;
  filterInputRef?: RefObject<HTMLInputElement | null>;
  clearFilterRef?: MutableRefObject<(() => void) | null>;
}

export default function Sidebar({
  savedFlows,
  activeFlowId,
  onLoadFlow,
  onDeleteFlow,
  getNodeLabel,
  collapsed,
  onToggleCollapse,
  width,
  filterInputRef,
  clearFilterRef,
}: SidebarProps) {
  const [filter, setFilter] = useState("");
  if (clearFilterRef) clearFilterRef.current = () => setFilter("");
  const q = filter.toLowerCase();

  const builtins = registry
    .getBuiltins()
    .filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.technologies.some((t) => t.name.toLowerCase().includes(q)),
    );
  const patterns = BUILTIN_PATTERNS.filter(
    (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
  );
  const annotations = ANNOTATION_ITEMS.filter((a) => a.label.toLowerCase().includes(q));

  function onDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData("application/system-designer", type);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <aside
      className={`bg-surface border-r border-border flex flex-col z-10 transition-[width,min-width] duration-200 min-h-0${collapsed ? " overflow-visible" : " overflow-hidden"}`}
      style={width ? { width, minWidth: width } : undefined}
    >
      <div
        className={
          collapsed
            ? "flex items-center justify-center px-3 pt-4 pb-3 gap-2"
            : "flex items-center justify-between px-4 pt-4 pb-3 gap-2"
        }
      >
        {!collapsed && (
          <h2
            className="text-[13px] font-semibold uppercase tracking-wide text-text-dim"
            style={{ padding: 0 }}
          >
            Components
          </h2>
        )}
        <button
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-2 hover:text-text-bright"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {collapsed ? (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            ) : (
              <>
                <polyline points="11 17 6 12 11 7" />
                <line x1="6" y1="12" x2="18" y2="12" />
              </>
            )}
          </svg>
        </button>
      </div>
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={filterInputRef}
              type="text"
              className="w-full bg-surface-2 border border-border rounded-md text-sm text-text-bright placeholder:text-text-dim pl-8 pr-8 py-1.5 outline-none focus:border-accent transition-colors duration-150"
              placeholder="Filter…  /"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setFilter("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            {filter && (
              <button
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-text-dim transition-colors duration-150 hover:text-text-bright"
                onClick={() => {
                  setFilter("");
                  filterInputRef?.current?.focus();
                }}
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
            )}
          </div>
        </div>
      )}
      {collapsed ? (
        <>
          <div className="px-1 overflow-visible flex flex-col gap-0.5">
            {registry.getBuiltins().map((entry) => (
              <div
                key={entry.id}
                className="sidebar-item-tooltip relative flex items-center gap-3 rounded-lg cursor-grab select-none text-text-bright text-sm font-medium transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing active:bg-surface-3 justify-center p-2"
                draggable
                onDragStart={(e) => onDragStart(e, entry.id)}
                data-tooltip={entry.label}
                title={entry.label}
              >
                <div
                  className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: entry.color }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={entry.icon} />
                  </svg>
                </div>
              </div>
            ))}
          </div>
          <div className="px-1 overflow-visible flex flex-col gap-0.5 border-t border-border pt-2 pb-2 mt-2">
            {BUILTIN_PATTERNS.map((pattern) => (
              <div
                key={pattern.id}
                className="sidebar-item-tooltip relative flex items-center gap-3 rounded-lg cursor-grab select-none text-text-bright text-sm font-medium transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing active:bg-surface-3 justify-center p-2"
                draggable
                onDragStart={(e) => onDragStart(e, `pattern:${pattern.id}`)}
                data-tooltip={pattern.name}
                title={pattern.name}
              >
                <div
                  className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: pattern.color }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={pattern.icon} />
                  </svg>
                </div>
              </div>
            ))}
          </div>
          <div className="px-1 overflow-visible flex flex-col gap-0.5 border-t border-border pt-2 pb-2 mt-2">
            {ANNOTATION_ITEMS.map((item) => (
              <div
                key={item.type}
                className="sidebar-item-tooltip relative flex items-center gap-3 rounded-lg cursor-grab select-none text-text-bright text-sm font-medium transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing active:bg-surface-3 justify-center p-2"
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                data-tooltip={item.label}
                title={item.label}
              >
                <div
                  className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: item.bg }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={item.stroke}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={item.icon} />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {builtins.length > 0 && (
            <div className="px-2 flex flex-col gap-0.5">
              {builtins.map((entry) => (
                <div
                  key={entry.id}
                  className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab select-none text-text-bright text-sm font-medium transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing active:bg-surface-3"
                  draggable
                  onDragStart={(e) => onDragStart(e, entry.id)}
                  data-tooltip={entry.label}
                  title={entry.label}
                >
                  <div
                    className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: entry.color }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={entry.icon} />
                    </svg>
                  </div>
                  <span>{entry.label}</span>
                </div>
              ))}
            </div>
          )}
          {patterns.length > 0 && (
            <>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-dim pt-3 px-4 pb-3">
                Patterns
              </h2>
              <div className="px-2 flex flex-col gap-0.5 pb-2">
                {patterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab select-none text-text-bright text-sm font-medium transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing active:bg-surface-3"
                    draggable
                    onDragStart={(e) => onDragStart(e, `pattern:${pattern.id}`)}
                    title={pattern.description}
                  >
                    <div
                      className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: pattern.color }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={pattern.icon} />
                      </svg>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span>{pattern.name}</span>
                      <span className="text-[11px] text-text-dim truncate">
                        {pattern.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {annotations.length > 0 && (
            <>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-dim pt-3 px-4 pb-3">
                Annotations
              </h2>
              <div className="px-2 flex flex-col gap-0.5 pb-2">
                {annotations.map((item) => (
                  <div
                    key={item.type}
                    className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab select-none text-text-bright text-sm font-medium transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing active:bg-surface-3"
                    draggable
                    onDragStart={(e) => onDragStart(e, item.type)}
                    data-tooltip={item.label}
                    title={item.label}
                  >
                    <div
                      className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0 ${item.bg}`}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={item.stroke}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        dangerouslySetInnerHTML={{ __html: `<${item.icon}" />` }}
                      />
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {q && builtins.length === 0 && patterns.length === 0 && annotations.length === 0 && (
            <div className="px-4 py-6 text-sm text-text-dim text-center">No matches</div>
          )}
          {!q && savedFlows.length > 0 && (
            <>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-dim pt-3 px-4 pb-3">
                Paths
              </h2>
              <div className="px-2 pb-2 flex flex-col gap-1">
                {savedFlows.map((flow) => (
                  <div
                    key={flow.id}
                    className={`group px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-150 border border-transparent hover:bg-surface-2${activeFlowId === flow.id ? " bg-accent-bg border-accent" : ""}`}
                    onClick={() => onLoadFlow(flow)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-text-bright whitespace-nowrap overflow-hidden text-ellipsis">
                        {flow.name}
                      </span>
                      <button
                        className="flex items-center justify-center w-[22px] h-[22px] rounded text-text-dim shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-[rgba(239,68,68,0.15)] hover:text-[#ef4444]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFlow(flow.id);
                        }}
                        title="Delete flow"
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
                    {flow.description && (
                      <span className="block text-[11px] text-text-dim mt-1 leading-snug overflow-hidden text-ellipsis line-clamp-2">
                        {flow.description}
                      </span>
                    )}
                    <div className="flex items-center flex-wrap gap-0.5 mt-1.5 text-[11px] text-text leading-relaxed">
                      {flow.steps.map((id, i) => (
                        <span key={`${id}-${i}`}>
                          {i > 0 && <span className="text-text-dim mx-0.5">&rarr;</span>}
                          <span>{getNodeLabel(id)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {!collapsed && (
        <div className="p-4 text-xs text-text-dim leading-snug border-t border-border mt-auto">
          Drag components to canvas to build your system
        </div>
      )}
    </aside>
  );
}
