import { registry } from "../registry";

interface SavedFlow {
  id: string;
  name: string;
  description: string;
  steps: string[];
}

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
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`} style={width ? { width, minWidth: width } : undefined}>
      <div className="sidebar-collapse-row">
        {!collapsed && (
          <h2 className="sidebar-title" style={{ padding: 0 }}>
            Components
          </h2>
        )}
        <button
          className="sidebar-collapse-btn"
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
      <div className="sidebar-list">
        {registry.getBuiltins().map((entry) => (
          <div
            key={entry.id}
            className="sidebar-item"
            draggable
            onDragStart={(e) => onDragStart(e, entry.id)}
            data-tooltip={entry.label}
            title={entry.label}
          >
            <div className="sidebar-icon" style={{ background: entry.color }}>
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
          <h2 className="sidebar-title" style={{ paddingTop: "12px" }}>
            Annotations
          </h2>
          <div className="sidebar-list" style={{ flex: "none", paddingBottom: "8px" }}>
            <div
              className="sidebar-item"
              draggable
              onDragStart={(e) => onDragStart(e, "sticky")}
              data-tooltip="Sticky Note"
              title="Sticky Note"
            >
              <div className="sidebar-icon sticky-icon">
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
              className="sidebar-item"
              draggable
              onDragStart={(e) => onDragStart(e, "text")}
              data-tooltip="Text"
              title="Text"
            >
              <div className="sidebar-icon text-icon">
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
          className="sidebar-list"
          style={{
            flex: "none",
            paddingBottom: "8px",
            borderTop: "1px solid var(--border)",
            paddingTop: "8px",
          }}
        >
          <div
            className="sidebar-item"
            draggable
            onDragStart={(e) => onDragStart(e, "sticky")}
            data-tooltip="Sticky Note"
          >
            <div className="sidebar-icon sticky-icon">
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
            className="sidebar-item"
            draggable
            onDragStart={(e) => onDragStart(e, "text")}
            data-tooltip="Text"
          >
            <div className="sidebar-icon text-icon">
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
          <h2 className="sidebar-title" style={{ paddingTop: "12px" }}>
            Paths
          </h2>
          <div className="sidebar-paths">
            {savedFlows.map((flow) => (
              <div
                key={flow.id}
                className={`sidebar-path${activeFlowId === flow.id ? " active" : ""}`}
                onClick={() => onLoadFlow(flow)}
              >
                <div className="sidebar-path-header">
                  <span className="sidebar-path-name">{flow.name}</span>
                  <button
                    className="sidebar-path-delete"
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
                {flow.description && <span className="sidebar-path-desc">{flow.description}</span>}
                <div className="sidebar-path-steps">
                  {flow.steps.map((id, i) => (
                    <span key={`${id}-${i}`}>
                      {i > 0 && <span className="sidebar-path-arrow">&rarr;</span>}
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
        <div className="sidebar-footer">Drag components to canvas to build your system</div>
      )}
    </aside>
  );
}
