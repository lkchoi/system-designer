import type { Edge } from '@xyflow/react';
import type { EdgeData, EdgeProtocol, EdgeFormat } from '../types';
import { EDGE_PROTOCOLS, EDGE_FORMATS } from '../types';

interface Props {
  edge: Edge<EdgeData>;
  sourceLabel: string;
  targetLabel: string;
  onUpdate: (id: string, data: Partial<EdgeData>) => void;
  onClose: () => void;
}

export default function EdgePropertiesPanel({ edge, sourceLabel, targetLabel, onUpdate, onClose }: Props) {
  const data = edge.data!;

  return (
    <aside className="properties-panel">
      <div className="properties-header">
        <h2>Connection</h2>
        <button className="properties-close" onClick={onClose}>&times;</button>
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
