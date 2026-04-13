import { useState } from 'react';
import type { Node } from '@xyflow/react';
import type { SystemNodeData, NodeStatus, Endpoint } from '../types';
import type { Mode } from '../App';
import { getComponentDef, displayType, PLAN_FIELDS } from '../data';
import { TECHNOLOGY_CATALOG, getTechnology } from '../technologies';
import { ulid } from 'ulid';

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

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export default function PropertiesPanel({ node, mode, onUpdate, onClose }: Props) {
  const { data } = node;
  const def = getComponentDef(data.componentType);
  const planFields = PLAN_FIELDS[data.componentType] ?? [];
  const [editingEndpointId, setEditingEndpointId] = useState<string | null>(null);

  function updatePlanField(key: string, value: string) {
    onUpdate(node.id, { plan: { ...data.plan, [key]: value } });
  }

  function addEndpoint() {
    const ep: Endpoint = { id: ulid(), method: 'GET', path: '' };
    onUpdate(node.id, { endpoints: [...(data.endpoints ?? []), ep] });
    setEditingEndpointId(ep.id);
  }

  function updateEndpoint(id: string, partial: Partial<Endpoint>) {
    onUpdate(node.id, {
      endpoints: (data.endpoints ?? []).map(ep =>
        ep.id === id ? { ...ep, ...partial } : ep
      ),
    });
  }

  function deleteEndpoint(id: string) {
    onUpdate(node.id, {
      endpoints: (data.endpoints ?? []).filter(ep => ep.id !== id),
    });
    if (editingEndpointId === id) setEditingEndpointId(null);
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

        {(mode === 'stress' || mode === 'monitor') && (
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
        )}

        {mode === 'plan' && data.componentType === 'api-gateway' && (
          <div className="prop-group">
            <div className="endpoint-list-header">
              <label className="prop-label">Endpoints</label>
              <button className="endpoint-add-btn" onClick={addEndpoint}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                Add
              </button>
            </div>
            {(data.endpoints ?? []).length === 0 ? (
              <div className="endpoint-empty">No endpoints defined</div>
            ) : (
              <div className="endpoint-list">
                {(data.endpoints ?? []).map(ep => (
                  editingEndpointId === ep.id ? (
                    <div key={ep.id} className="endpoint-item editing">
                      <select
                        className="endpoint-method-select"
                        value={ep.method}
                        onChange={e => updateEndpoint(ep.id, { method: e.target.value })}
                      >
                        {HTTP_METHODS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <input
                        className="endpoint-path-input"
                        value={ep.path}
                        onChange={e => updateEndpoint(ep.id, { path: e.target.value })}
                        placeholder="/api/v1/resource"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingEndpointId(null); }}
                      />
                      <button className="endpoint-action-btn" onClick={() => setEditingEndpointId(null)} title="Done">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                    </div>
                  ) : (
                    <div key={ep.id} className="endpoint-item">
                      <span className={`endpoint-method ${ep.method.toLowerCase()}`}>{ep.method}</span>
                      <span className="endpoint-path">{ep.path || '/...'}</span>
                      <div className="endpoint-item-actions">
                        <button className="endpoint-action-btn" onClick={() => setEditingEndpointId(ep.id)} title="Edit">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="endpoint-action-btn delete" onClick={() => deleteEndpoint(ep.id)} title="Delete">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'plan' ? (
          <div className="prop-group">
            <label className="prop-label">Plan</label>
            {planFields.map(field => (
              <div key={field.key} className="plan-field">
                <label className="plan-field-label">{field.label}</label>
                {field.type === 'technology' ? (
                  <>
                    <select
                      className="plan-field-select"
                      value={data.plan?.[field.key] ?? ''}
                      onChange={e => updatePlanField(field.key, e.target.value)}
                    >
                      <option value="">Select a technology...</option>
                      {(TECHNOLOGY_CATALOG[data.componentType] ?? []).map(tech => (
                        <option key={tech.name} value={tech.name}>{tech.name}</option>
                      ))}
                    </select>
                    {data.plan?.[field.key] && (() => {
                      const tech = getTechnology(data.componentType, data.plan[field.key]);
                      if (!tech) return null;
                      return (
                        <div className="tech-info-card">
                          <div className="tech-info-row">
                            <span className="tech-info-label">Purpose</span>
                            <span className="tech-info-value">{tech.purpose}</span>
                          </div>
                          <div className="tech-info-row">
                            <span className="tech-info-label">Throughput</span>
                            <span className="tech-info-value">{tech.throughput}</span>
                          </div>
                          <div className="tech-info-row">
                            <span className="tech-info-label">Limits</span>
                            <span className="tech-info-value">{tech.limits}</span>
                          </div>
                          <div className="tech-info-row">
                            <span className="tech-info-label">Providers</span>
                            <div className="tech-provider-tags">
                              {tech.providers.map(p => (
                                <span key={p} className="tech-provider-tag">{p}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <textarea
                    className="plan-field-input"
                    value={data.plan?.[field.key] ?? ''}
                    onChange={e => updatePlanField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={1}
                  />
                )}
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

        {mode === 'plan' && (
          <div className="prop-group">
            <label className="prop-label">Sharding</label>
            <div className="shard-toggle-row">
              <span className="shard-toggle-label">{data.sharded ? 'Sharded' : 'Not Sharded'}</span>
              <button
                className={`shard-toggle-track${data.sharded ? ' active' : ''}`}
                onClick={() => onUpdate(node.id, {
                  sharded: !data.sharded,
                  ...(!data.sharded ? {} : { shardKey: '' }),
                })}
              >
                <span className="shard-toggle-thumb" />
              </button>
            </div>
            {data.sharded && (
              <div className="plan-field" style={{ marginTop: 8 }}>
                <label className="plan-field-label">Shard Key</label>
                <input
                  className="prop-input"
                  value={data.shardKey}
                  onChange={e => onUpdate(node.id, { shardKey: e.target.value })}
                  placeholder="e.g. user_id, tenant_id"
                />
              </div>
            )}
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
