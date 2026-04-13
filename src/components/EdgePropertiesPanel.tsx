import type { Edge } from '@xyflow/react';
import type { EdgeData, EdgeProtocol, EdgeFormat } from '../types';
import { EDGE_PROTOCOLS, EDGE_FORMATS } from '../types';
import type { PanelPosition } from '../App';

interface Props {
  edge: Edge<EdgeData>;
  sourceLabel: string;
  targetLabel: string;
  onUpdate: (id: string, data: Partial<EdgeData>) => void;
  onClose: () => void;
  panelPosition: PanelPosition;
  onTogglePanelPosition: () => void;
}

export default function EdgePropertiesPanel({ edge, sourceLabel, targetLabel, onUpdate, onClose, panelPosition, onTogglePanelPosition }: Props) {
  const data = edge.data!;

  return (
    <aside className={`properties-panel${panelPosition === 'bottom' ? ' bottom' : ''}`}>
      <div className="properties-header">
        <h2>Connection</h2>
        <div className="properties-header-actions">
          <button
            className="properties-dock-btn"
            onClick={onTogglePanelPosition}
            title={panelPosition === 'right' ? 'Dock to bottom' : 'Dock to right'}
          >
            {panelPosition === 'right' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            )}
          </button>
          <button className="properties-close" onClick={onClose}>&times;</button>
        </div>
      </div>

      <div className="properties-body">
        <div className="prop-group">
          <label className="prop-label">Route</label>
          <div className="edge-route">
            <span className="edge-route-node">{sourceLabel}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            <span className="edge-route-node">{targetLabel}</span>
          </div>
        </div>

        <div className="prop-group">
          <label className="prop-label">Label</label>
          <input
            className="prop-input"
            value={data.label}
            onChange={e => onUpdate(edge.id, { label: e.target.value })}
            placeholder="e.g. fetch user data"
          />
        </div>

        <div className="prop-group">
          <label className="prop-label">Protocol</label>
          <div className="edge-chip-grid">
            {EDGE_PROTOCOLS.map(p => (
              <button
                key={p}
                className={`edge-chip${data.protocol === p ? ' active' : ''}`}
                onClick={() => onUpdate(edge.id, { protocol: (data.protocol === p ? '' : p) as EdgeProtocol })}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="prop-group">
          <label className="prop-label">Format</label>
          <div className="edge-chip-grid">
            {EDGE_FORMATS.map(f => (
              <button
                key={f}
                className={`edge-chip${data.format === f ? ' active' : ''}`}
                onClick={() => onUpdate(edge.id, { format: (data.format === f ? '' : f) as EdgeFormat })}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
