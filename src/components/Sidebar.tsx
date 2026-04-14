import { registry } from "../registry";
import type { SavedFlow } from "../types";

interface SidebarProps {
  savedFlows: SavedFlow[];
  activeFlowId: string | null;
  onLoadFlow: (flow: SavedFlow) => void;
  onDeleteFlow: (id: string) => void;
  getNodeLabel: (id: string) => string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  width?: number;
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
}: SidebarProps) {
  function onDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData("application/system-designer", type);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <aside className={`bg-surface border-r border-border flex flex-col z-10 transition-[width,min-width] duration-200${collapsed ? " overflow-visible" : ""}`} style={width ? { width, minWidth: width } : undefined}>
      <div className={collapsed ? "flex items-center justify-center px-3 pt-4 pb-3 gap-2" : "flex items-center justify-between px-4 pt-4 pb-3 gap-2"}>
        {!collapsed && (
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-dim" style={{ padding: 0 }}>
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
      <div className={collapsed ? "px-1 overflow-visible flex flex-col gap-0.5" : "flex-1 overflow-y-auto px-2 flex flex-col gap-0.5"}>
        {registry.getBuiltins().map((entry) => (
          <div
            key={entry.id}
            className={collapsed ? "sidebar-item-tooltip relative flex items-center gap-3 rounded-lg cursor-grab select-none text-text-bright text-sm font-medium transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing active:bg-surface-3 justify-center p-2" : "relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab select-none text-text-bright text-sm font-medium transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing active:bg-surface-3"}
            draggable
            onDragStart={(e) => onDragStart(e, entry.id)}
            data-tooltip={entry.label}
            title={entry.label}
          >
            <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0" style={{ background: entry.color }}>
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
            {!collapsed && <span>{entry.label}</span>}
          </div>
        ))}
      </div>
      {!collapsed && (
        <>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-dim" style={{ paddingTop: "12px" }}>
            Annotations
          </h2>
          <div className={collapsed ? "px-1 overflow-visible flex flex-col gap-0.5" : "flex-1 overflow-y-auto px-2 flex flex-col gap-0.5"} style={{ flex: "none", paddingBottom: "8px" }}>
            <div
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab select-none text-text-bright text-sm font-medium transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing active:bg-surface-3"
              draggable
              onDragStart={(e) => onDragStart(e, "sticky")}
              data-tooltip="Sticky Note"
              title="Sticky Note"
            >
              <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0 bg-[#fde68a]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#92400e"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15.5 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.5L15.5 3z" />
                  <polyline points="14 3 14 8 21 8" />
                </svg>
              </div>
              <span>Sticky Note</span>
            </div>
            <div
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab select-none text-text-bright text-sm font-medium transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing active:bg-surface-3"
              draggable
              onDragStart={(e) => onDragStart(e, "text")}
              data-tooltip="Text"
              title="Text"
            >
              <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0 bg-surface-3">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 7V4h16v3M9 20h6M12 4v16" />
                </svg>
              </div>
              <span>Text</span>
            </div>
          </div>
        </>
      )}
      {collapsed && (
        <div
          className="px-1 overflow-visible flex flex-col gap-0.5"
          style={{
            flex: "none",
            paddingBottom: "8px",
            borderTop: "1px solid var(--border)",
            paddingTop: "8px",
          }}
        >
          <div
            className="sidebar-item-tooltip relative flex items-center gap-3 rounded-lg cursor-grab select-none text-text-bright text-sm font-medium transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing active:bg-surface-3 justify-center p-2"
            draggable
            onDragStart={(e) => onDragStart(e, "sticky")}
            data-tooltip="Sticky Note"
            title="Sticky Note"
          >
            <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0 bg-[#fde68a]">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#92400e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15.5 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.5L15.5 3z" />
                <polyline points="14 3 14 8 21 8" />
              </svg>
            </div>
          </div>
          <div
            className="sidebar-item-tooltip relative flex items-center gap-3 rounded-lg cursor-grab select-none text-text-bright text-sm font-medium transition-colors duration-150 hover:bg-surface-2 active:cursor-grabbing active:bg-surface-3 justify-center p-2"
            draggable
            onDragStart={(e) => onDragStart(e, "text")}
            data-tooltip="Text"
            title="Text"
          >
            <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0 bg-surface-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7V4h16v3M9 20h6M12 4v16" />
              </svg>
            </div>
          </div>
        </div>
      )}
      {!collapsed && savedFlows.length > 0 && (
        <>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-dim" style={{ paddingTop: "12px" }}>
            Paths
          </h2>
          <div className="overflow-y-auto px-2 pb-2 flex flex-col gap-1">
            {savedFlows.map((flow) => (
              <div
                key={flow.id}
                className={`group px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-150 border border-transparent hover:bg-surface-2${activeFlowId === flow.id ? " bg-accent-bg border-accent" : ""}`}
                onClick={() => onLoadFlow(flow)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-text-bright whitespace-nowrap overflow-hidden text-ellipsis">{flow.name}</span>
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
                {flow.description && <span className="block text-[11px] text-text-dim mt-1 leading-snug overflow-hidden text-ellipsis line-clamp-2">{flow.description}</span>}
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
      {!collapsed && (
        <div className="p-4 text-xs text-text-dim leading-snug border-t border-border mt-auto">Drag components to canvas to build your system</div>
      )}
    </aside>
  );
}
