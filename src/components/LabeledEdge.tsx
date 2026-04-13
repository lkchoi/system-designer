import { useState, useRef, useEffect } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { EdgeData } from '../types';
import { useMode, useStress } from '../App';

export default function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const mode = useMode();
  const { partitionedEdges } = useStress();
  const isStressMode = mode === 'stress';
  const isPartitioned = partitionedEdges.has(id);

  const edgeData = data as EdgeData | undefined;
  const label = edgeData?.label ?? '';
  const protocol = edgeData?.protocol ?? '';
  const format = edgeData?.format ?? '';
  const hasTags = protocol || format;

  const isBroken = isStressMode && isPartitioned;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    setDraft(label);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const event = new CustomEvent('edge-label-change', { detail: { id, label: draft } });
    window.dispatchEvent(event);
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: isBroken ? '#ef4444' : selected ? '#6366f1' : '#6366f180',
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: isBroken ? '8 4' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="edge-label-container"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          onDoubleClick={e => {
            e.stopPropagation();
            startEdit();
          }}
        >
          {isBroken && (
            <div className="edge-partition-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              <span>SPLIT</span>
            </div>
          )}
          {editing ? (
            <input
              ref={inputRef}
              className="edge-label-input"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
          ) : (
            <div className="edge-label-group">
              {hasTags && (
                <div className="edge-tags">
                  {protocol && <span className="edge-tag edge-tag-protocol">{protocol}</span>}
                  {format && <span className="edge-tag edge-tag-format">{format}</span>}
                </div>
              )}
              {label ? (
                <span className="edge-label">{label}</span>
              ) : selected && !hasTags ? (
                <span className="edge-label edge-label-hint">double-click to label</span>
              ) : null}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
