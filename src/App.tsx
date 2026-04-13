import { useState, useCallback, useRef, useMemo, useEffect, createContext, useContext } from 'react';
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  ConnectionMode,
} from '@xyflow/react';
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect, NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';

import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import SystemNode from './components/SystemNode';
import StickyNote from './components/StickyNote';
import TextNode from './components/TextNode';
import LabeledEdge from './components/LabeledEdge';
import { getComponentDef, randomMetrics } from './data';
import type { SystemNodeData, StickyNoteData, TextNodeData, ComponentType } from './types';
import { ulid } from 'ulid';

type SystemFlowNode = Node<SystemNodeData, 'system'>;
type StickyFlowNode = Node<StickyNoteData, 'sticky'>;
type TextFlowNode = Node<TextNodeData, 'text'>;
type AppNode = SystemFlowNode | StickyFlowNode | TextFlowNode;

const nodeTypes = { system: SystemNode, sticky: StickyNote, text: TextNode };
const edgeTypes = { labeled: LabeledEdge };

const typeCounters: Record<string, number> = {};

function generateLabel(type: ComponentType): string {
  const def = getComponentDef(type);
  const short = def.label.toLowerCase().split(' ')[0].slice(0, 6);
  typeCounters[type] = (typeCounters[type] ?? 0) + 1;
  return `${short}-${typeCounters[type]}`;
}

export type Mode = 'plan' | 'stress' | 'monitor' | 'price';

export const ModeContext = createContext<Mode>('plan');
export function useMode() { return useContext(ModeContext); }

function Canvas() {
  const [nodes, setNodes] = useState<AppNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('plan');
  const canvasRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const selectedNode = useMemo(
    () => nodes.find(n => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const onNodesChange: OnNodesChange<AppNode> = useCallback(
    (changes: NodeChange<AppNode>[]) => {
      setNodes(nds => applyNodeChanges(changes, nds));
      for (const change of changes) {
        if (change.type === 'remove' && change.id === selectedNodeId) {
          setSelectedNodeId(null);
        }
      }
    },
    [selectedNodeId],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    changes => setEdges(eds => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect: OnConnect = useCallback(
    params =>
      setEdges(eds =>
        addEdge(
          {
            ...params,
            id: ulid(),
            type: 'labeled',
            data: { label: '' },
          },
          eds,
        ),
      ),
    [],
  );

  useEffect(() => {
    function handleLabelChange(e: Event) {
      const { id, label } = (e as CustomEvent).detail;
      setEdges(eds => eds.map(edge => (edge.id === id ? { ...edge, data: { ...edge.data, label } } : edge)));
    }
    window.addEventListener('edge-label-change', handleLabelChange);
    return () => window.removeEventListener('edge-label-change', handleLabelChange);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/system-designer');
      if (!type) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      if (type === 'sticky') {
        const newNode: StickyFlowNode = {
          id: ulid(),
          type: 'sticky',
          position,
          style: { width: 200, height: 150 },
          data: { text: '', color: '#fde68a' },
        };
        setNodes(nds => [...nds, newNode]);
      } else if (type === 'text') {
        const newNode: TextFlowNode = {
          id: ulid(),
          type: 'text',
          position,
          style: { width: 260, height: 40 },
          data: { text: '', size: 'large' },
        };
        setNodes(nds => [...nds, newNode]);
      } else {
        const newNode: SystemFlowNode = {
          id: ulid(),
          type: 'system',
          position,
          data: {
            label: generateLabel(type as ComponentType),
            componentType: type as ComponentType,
            status: 'healthy',
            metrics: randomMetrics(),
            plan: {},
          },
        };
        setNodes(nds => [...nds, newNode]);
      }
    },
    [screenToFlowPosition],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: AppNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const onUpdateNodeData = useCallback(
    (id: string, partial: Partial<SystemNodeData>) => {
      setNodes(nds =>
        nds.map(n => (n.id === id ? { ...n, data: { ...n.data, ...partial } } as typeof n : n)),
      );
    },
    [],
  );

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    Object.keys(typeCounters).forEach(k => delete typeCounters[k]);
  }, []);

  const connectionCount = edges.length;

  return (
    <ModeContext.Provider value={mode}>
    <div className="app-layout">
      <Sidebar />
      <div className="canvas-area" ref={canvasRef}>
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">System Designer</h1>
            <nav className="topbar-tabs">
              <button className={`topbar-tab${mode === 'plan' ? ' active' : ''}`} onClick={() => setMode('plan')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Plan
              </button>
              <button className={`topbar-tab${mode === 'stress' ? ' active' : ''}`} onClick={() => setMode('stress')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Stress
              </button>
              <button className={`topbar-tab${mode === 'monitor' ? ' active' : ''}`} onClick={() => setMode('monitor')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Monitor
              </button>
              <button className={`topbar-tab${mode === 'price' ? ' active' : ''}`} onClick={() => setMode('price')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                Price
              </button>
            </nav>
          </div>
          <div className="topbar-right">
            <span className="topbar-stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              {nodes.length} nodes
            </span>
            <span className="topbar-stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
              {connectionCount} connections
            </span>
            <button className="clear-btn" onClick={clearCanvas}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Clear Canvas
            </button>
          </div>
        </header>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'labeled' }}
          connectionMode={ConnectionMode.Loose}
          fitView={false}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          proOptions={{ hideAttribution: true }}
          edgesReconnectable
          deleteKeyCode={['Delete', 'Backspace']}
          className="system-flow"
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a2b35" />
        </ReactFlow>
      </div>
      {selectedNode && selectedNode.type === 'system' && (
        <PropertiesPanel
          node={selectedNode as SystemFlowNode}
          mode={mode}
          onUpdate={onUpdateNodeData}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
    </ModeContext.Provider>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
