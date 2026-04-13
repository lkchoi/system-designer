import { Handle, Position, useReactFlow, NodeResizer } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { SystemNodeData } from '../types';
import { getComponentDef } from '../data';

const STATUS_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  idle: '#6b7280',
};

type SystemNode = Node<SystemNodeData, 'system'>;

export default function SystemNode({ id, data, selected }: NodeProps<SystemNode>) {
  const { deleteElements } = useReactFlow();
  const def = getComponentDef(data.componentType);

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={180}
        minHeight={100}
        lineStyle={{ border: '1px solid var(--accent)' }}
        handleStyle={{ width: 8, height: 8, background: 'var(--accent)', border: 'none', borderRadius: 2 }}
      />
      <Handle type="target" position={Position.Left} id="left-target" className="system-handle system-handle-left" />
      <Handle type="source" position={Position.Left} id="left-source" className="system-handle system-handle-left" />
      <div className={`system-node${selected ? ' selected' : ''}`}>
        <div className="system-node-header">
          <div className="system-node-icon" style={{ background: def.color }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={def.icon} />
            </svg>
          </div>
          <span className="system-node-label">{data.label}</span>
          <span className="system-node-status" style={{ background: STATUS_COLORS[data.status] }} />
        </div>
        <div className="system-node-metrics">
          <div className="system-node-metric">
            <span>CPU</span>
            <span className="metric-value">{data.metrics.cpu}%</span>
          </div>
          <div className="system-node-metric">
            <span>Memory</span>
            <span className="metric-value">{data.metrics.memory}%</span>
          </div>
        </div>
        <div className="system-node-actions">
          <button
            className="node-action-btn connect-btn"
            onPointerDown={e => e.stopPropagation()}
            title="Drag from handles to connect"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            <span>Connect</span>
          </button>
          <button
            className="node-action-btn delete-btn"
            onPointerDown={e => e.stopPropagation()}
            onClick={() => deleteElements({ nodes: [{ id }] })}
            title="Delete node"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>
      <Handle type="target" position={Position.Right} id="right-target" className="system-handle system-handle-right" />
      <Handle type="source" position={Position.Right} id="right-source" className="system-handle system-handle-right" />
    </>
  );
}
