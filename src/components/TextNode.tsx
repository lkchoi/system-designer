import { useReactFlow, NodeResizer } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { TextNodeData, TextSize } from '../types';

const SIZE_STYLES: Record<TextSize, { fontSize: string; fontWeight: number; lineHeight: string }> = {
  large: { fontSize: '24px', fontWeight: 700, lineHeight: '1.3' },
  medium: { fontSize: '16px', fontWeight: 600, lineHeight: '1.4' },
  small: { fontSize: '13px', fontWeight: 400, lineHeight: '1.5' },
};

type TextFlowNode = Node<TextNodeData, 'text'>;

export default function TextNode({ id, data, selected }: NodeProps<TextFlowNode>) {
  const { updateNodeData, deleteElements } = useReactFlow();
  const style = SIZE_STYLES[data.size];

  return (
    <>
      {selected && (
        <NodeResizer
          minWidth={120}
          minHeight={32}
          lineStyle={{ border: '1px dashed var(--border)' }}
          handleStyle={{ width: 8, height: 8, background: 'var(--accent)', border: 'none', borderRadius: 2 }}
        />
      )}
      <div className={`text-node${selected ? ' selected' : ''}`}>
        <textarea
          className="text-node-input"
          style={{ fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight }}
          value={data.text}
          onChange={e => updateNodeData(id, { text: e.target.value })}
          onPointerDown={e => e.stopPropagation()}
          placeholder={data.size === 'large' ? 'Title...' : data.size === 'medium' ? 'Heading...' : 'Description...'}
        />
        {selected && (
          <div className="text-node-toolbar">
            <div className="text-size-btns">
              {(['large', 'medium', 'small'] as TextSize[]).map(s => (
                <button
                  key={s}
                  className={`text-size-btn${data.size === s ? ' active' : ''}`}
                  onClick={() => updateNodeData(id, { size: s })}
                  onPointerDown={e => e.stopPropagation()}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <button
              className="text-node-delete"
              onClick={() => deleteElements({ nodes: [{ id }] })}
              onPointerDown={e => e.stopPropagation()}
              title="Delete"
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
