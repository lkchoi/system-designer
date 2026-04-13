import type { Node } from '@xyflow/react';
import type { SystemNodeData, NodeStatus } from '../types';
import type { Mode } from '../App';
import { getComponentDef, displayType, PLAN_FIELDS } from '../data';

const STATUSES: NodeStatus[] = ['healthy', 'warning', 'error', 'idle'];

const STATUS_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  idle: '#6b7280',
};

interface Props {
  node: Node<SystemNodeData>;
  mode: Mode;
  onUpdate: (id: string, data: Partial<SystemNodeData>) => void;
  onClose: () => void;
}

export default function PropertiesPanel({ node, mode, onUpdate, onClose }: Props) {
  const { data } = node;
  const def = getComponentDef(data.componentType);
  const planFields = PLAN_FIELDS[data.componentType] ?? [];

  function updatePlanField(key: string, value: string) {
    onUpdate(node.id, { plan: { ...data.plan, [key]: value } });
  }

  return (
    <aside className="properties-panel">
      <div className="properties-header">
        <h2>Properties</h2>
        <button className="properties-close" onClick={onClose}>&times;</button>
      </div>

      <div className="properties-body">
        <div className="prop-group">
          <label className="prop-label">Label</label>
          <input
            className="prop-input"
            value={data.label}
            onChange={e => onUpdate(node.id, { label: e.target.value })}
          />
        </div>

        <div className="prop-group">
          <label className="prop-label">Type</label>
          <div className="prop-value-box">{displayType(data.componentType)}</div>
        </div>

        <div className="prop-group">
          <label className="prop-label">Status</label>
          <div className="status-grid">
            {STATUSES.map(s => (
              <button
                key={s}
                className={`status-btn${data.status === s ? ' active' : ''}`}
                style={data.status === s ? { borderColor: STATUS_COLORS[s], background: STATUS_COLORS[s] + '22' } : undefined}
                onClick={() => onUpdate(node.id, { status: s })}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {mode === 'plan' ? (
          <div className="prop-group">
            <label className="prop-label">Plan</label>
            {planFields.map(field => (
              <div key={field.key} className="plan-field">
                <label className="plan-field-label">{field.label}</label>
                <textarea
                  className="plan-field-input"
                  value={data.plan?.[field.key] ?? ''}
                  onChange={e => updatePlanField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={1}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="prop-group">
            <label className="prop-label">Metrics</label>

            <div className="metric-card">
              <div className="metric-card-header">
                <div className="metric-icon" style={{ background: def.color + '33', color: def.color }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                </div>
                <span>CPU Usage</span>
              </div>
              <div className="metric-big-value">{data.metrics.cpu} <span className="metric-unit">%</span></div>
              <div className="metric-bar">
                <div className="metric-bar-fill cpu-bar" style={{ width: `${data.metrics.cpu}%` }} />
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-card-header">
                <div className="metric-icon" style={{ background: '#ec489933', color: '#ec4899' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4m4 0h4"/></svg>
                </div>
                <span>Memory Usage</span>
              </div>
              <div className="metric-big-value">{data.metrics.memory} <span className="metric-unit">%</span></div>
              <div className="metric-bar">
                <div className="metric-bar-fill memory-bar" style={{ width: `${data.metrics.memory}%` }} />
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-card-header">
                <div className="metric-icon" style={{ background: '#eab30833', color: '#eab308' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                </div>
                <span>Requests/sec</span>
              </div>
              <div className="metric-big-value">{data.metrics.requestsPerSec} <span className="metric-unit">req/s</span></div>
            </div>

            <div className="metric-card">
              <div className="metric-card-header">
                <div className="metric-icon" style={{ background: '#6366f133', color: '#6366f1' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </div>
                <span>Latency</span>
              </div>
              <div className="metric-big-value">{data.metrics.latency} <span className="metric-unit">ms</span></div>
            </div>
          </div>
        )}

        <div className="prop-group">
          <label className="prop-label">Position</label>
          <div className="position-grid">
            <div className="position-box">
              <span className="position-label">X</span>
              <span className="position-value">{Math.round(node.position.x)}</span>
            </div>
            <div className="position-box">
              <span className="position-label">Y</span>
              <span className="position-value">{Math.round(node.position.y)}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
