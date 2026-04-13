import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect, NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';

import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import SystemNode from './components/SystemNode';
import StickyNote from './components/StickyNote';
import LabeledEdge from './components/LabeledEdge';
import { getComponentDef, randomMetrics } from './data';
import type { SystemNodeData, StickyNoteData, ComponentType } from './types';

type SystemFlowNode = Node<SystemNodeData, 'system'>;
type StickyFlowNode = Node<StickyNoteData, 'sticky'>;
type AppNode = SystemFlowNode | StickyFlowNode;

const nodeTypes = { system: SystemNode, sticky: StickyNote };
const edgeTypes = { labeled: LabeledEdge };

let nodeIdCounter = 0;
const typeCounters: Record<string, number> = {};

function generateNodeId() {
  return `node-${++nodeIdCounter}`;
}

function generateLabel(type: ComponentType): string {
  const def = getComponentDef(type);
  const short = def.label.toLowerCase().split(' ')[0].slice(0, 6);
  typeCounters[type] = (typeCounters[type] ?? 0) + 1;
  return `${short}-${typeCounters[type]}`;
}

function Canvas() {
  const [nodes, setNodes] = useState<AppNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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
          id: generateNodeId(),
          type: 'sticky',
          position,
          style: { width: 200, height: 150 },
          data: { text: '', color: '#fde68a' },
        };
        setNodes(nds => [...nds, newNode]);
      } else {
        const newNode: SystemFlowNode = {
          id: generateNodeId(),
          type: 'system',
          position,
          data: {
            label: generateLabel(type as ComponentType),
            componentType: type as ComponentType,
            status: 'healthy',
            metrics: randomMetrics(),
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
    nodeIdCounter = 0;
  }, []);

  const connectionCount = edges.length;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="canvas-area" ref={canvasRef}>
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">System Designer</h1>
            <span className="topbar-stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              {nodes.length} nodes
            </span>
            <span className="topbar-stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
              {connectionCount} connections
            </span>
          </div>
          <button className="clear-btn" onClick={clearCanvas}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Clear Canvas
          </button>
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
          fitView={false}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          proOptions={{ hideAttribution: true }}
          edgesReconnectable
          deleteKeyCode={['Delete', 'Backspace']}
          className="system-flow"
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a2b35" />
          <svg width="0" height="0">
            <defs>
              <filter id="flow-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>
        </ReactFlow>
      </div>
      {selectedNode && selectedNode.type === 'system' && (
        <PropertiesPanel
          node={selectedNode as SystemFlowNode}
          onUpdate={onUpdateNodeData}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
