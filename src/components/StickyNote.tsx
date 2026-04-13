import { NodeResizer, useReactFlow } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { StickyNoteData, StickyColor } from '../types';
import { STICKY_COLORS } from '../types';

type StickyNode = Node<StickyNoteData, 'sticky'>;

export default function StickyNote({ id, data, selected }: NodeProps<StickyNode>) {
  const { updateNodeData, deleteElements } = useReactFlow();

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={140}
        minHeight={100}
        lineStyle={{ border: '1px solid rgba(0,0,0,0.2)' }}
        handleStyle={{ width: 8, height: 8, background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: 2 }}
      />
      <div className={`sticky-note${selected ? ' selected' : ''}`} style={{ background: data.color }}>
        <textarea
          className="sticky-text"
          value={data.text}
          onChange={e => updateNodeData(id, { text: e.target.value })}
          onPointerDown={e => e.stopPropagation()}
          placeholder="Type a note..."
        />
        {selected && (
          <div className="sticky-toolbar">
            <div className="sticky-colors">
              {STICKY_COLORS.map(c => (
                <button
                  key={c}
                  className={`sticky-color-btn${data.color === c ? ' active' : ''}`}
                  style={{ background: c }}
                  onClick={() => updateNodeData(id, { color: c as StickyColor })}
                  onPointerDown={e => e.stopPropagation()}
                />
              ))}
            </div>
            <button
              className="sticky-delete"
              onClick={() => deleteElements({ nodes: [{ id }] })}
              onPointerDown={e => e.stopPropagation()}
              title="Delete note"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
