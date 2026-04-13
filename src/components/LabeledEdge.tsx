import { useState, useRef, useEffect } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

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

  const label = (data?.label as string) ?? '';

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
          stroke: selected ? '#6366f180' : '#6366f140',
          strokeWidth: selected ? 3 : 2,
        }}
      />
      <circle r="3" fill="#6366f1" filter="url(#flow-glow)">
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} keyPoints="1;0" keyTimes="0;1" />
      </circle>
      <circle r="3" fill="#6366f1" filter="url(#flow-glow)">
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} keyPoints="1;0" keyTimes="0;1" begin="0.66s" />
      </circle>
      <circle r="3" fill="#6366f1" filter="url(#flow-glow)">
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} keyPoints="1;0" keyTimes="0;1" begin="1.33s" />
      </circle>
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
          ) : label ? (
            <span className="edge-label">{label}</span>
          ) : selected ? (
            <span className="edge-label edge-label-hint">double-click to label</span>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
