import { COMPONENTS } from '../data';

export default function Sidebar() {
  function onDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData('application/system-designer', type);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">Components</h2>
      <div className="sidebar-list">
        {COMPONENTS.map(comp => (
          <div
            key={comp.type}
            className="sidebar-item"
            draggable
            onDragStart={e => onDragStart(e, comp.type)}
          >
            <div className="sidebar-icon" style={{ background: comp.color }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={comp.icon} />
              </svg>
            </div>
            <span>{comp.label}</span>
          </div>
        ))}
      </div>
      <h2 className="sidebar-title" style={{ paddingTop: '12px' }}>Annotations</h2>
      <div className="sidebar-list" style={{ flex: 'none', paddingBottom: '8px' }}>
        <div
          className="sidebar-item"
          draggable
          onDragStart={e => onDragStart(e, 'sticky')}
        >
          <div className="sidebar-icon sticky-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15.5 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.5L15.5 3z" />
              <polyline points="14 3 14 8 21 8" />
            </svg>
          </div>
          <span>Sticky Note</span>
        </div>
        <div
          className="sidebar-item"
          draggable
          onDragStart={e => onDragStart(e, 'text')}
        >
          <div className="sidebar-icon text-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7V4h16v3M9 20h6M12 4v16" />
            </svg>
          </div>
          <span>Text</span>
        </div>
      </div>
      <div className="sidebar-footer">
        Drag components to canvas to build your system
      </div>
    </aside>
  );
}
