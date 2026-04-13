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

interface SavedFlow {
  id: string;
  name: string;
  description: string;
  steps: string[];
}

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
  const [flowPath, setFlowPath] = useState<string[]>([]);
  const [isPathMode, setIsPathMode] = useState(false);
  const [savedFlows, setSavedFlows] = useState<SavedFlow[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pathStepsRef = useRef<HTMLDivElement>(null);
  const saveNameRef = useRef<HTMLInputElement>(null);
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
        const w = 200, h = 150;
        const newNode: StickyFlowNode = {
          id: ulid(),
          type: 'sticky',
          position: { x: position.x - w / 2, y: position.y - h / 2 },
          style: { width: w, height: h },
          data: { text: '', color: '#fde68a' },
        };
        setNodes(nds => [...nds, newNode]);
      } else if (type === 'text') {
        const w = 260, h = 40;
        const newNode: TextFlowNode = {
          id: ulid(),
          type: 'text',
          position: { x: position.x - w / 2, y: position.y - h / 2 },
          style: { width: w, height: h },
          data: { text: '', size: 'large' },
        };
        setNodes(nds => [...nds, newNode]);
      } else {
        const w = 180, h = 50;
        const newNode: SystemFlowNode = {
          id: ulid(),
          type: 'system',
          position: { x: position.x - w / 2, y: position.y - h / 2 },
          data: {
            label: generateLabel(type as ComponentType),
            componentType: type as ComponentType,
            status: 'healthy',
            metrics: randomMetrics(),
            plan: {},
            sharded: false,
            shardKey: '',
            endpoints: [],
          },
        };
        setNodes(nds => [...nds, newNode]);
      }
    },
    [screenToFlowPosition],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: AppNode) => {
    if (isPathMode && node.type === 'system') {
      setFlowPath(prev => {
        if (prev.length > 0 && prev[prev.length - 1] === node.id) {
          return prev.slice(0, -1);
        }
        return [...prev, node.id];
      });
      return;
    }
    setSelectedNodeId(node.id);
  }, [isPathMode]);

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

  const getNodeLabel = useCallback(
    (id: string) => {
      const node = nodes.find(n => n.id === id);
      if (!node || node.type !== 'system') return id;
      return (node.data as SystemNodeData).label;
    },
    [nodes],
  );

  const togglePathMode = useCallback(() => {
    setIsPathMode(prev => {
      if (!prev) setFlowPath([]);
      return !prev;
    });
  }, []);

  const clearPath = useCallback(() => {
    setFlowPath([]);
    setActiveFlowId(null);
  }, []);

  const saveFlow = useCallback(() => {
    if (!saveName.trim() || flowPath.length === 0) return;
    const flow: SavedFlow = {
      id: ulid(),
      name: saveName.trim(),
      description: saveDesc.trim(),
      steps: [...flowPath],
    };
    setSavedFlows(prev => [...prev, flow]);
    setShowSaveForm(false);
    setSaveName('');
    setSaveDesc('');
    setActiveFlowId(flow.id);
  }, [saveName, saveDesc, flowPath]);

  const deleteFlow = useCallback((id: string) => {
    setSavedFlows(prev => prev.filter(f => f.id !== id));
    if (activeFlowId === id) setActiveFlowId(null);
  }, [activeFlowId]);

  const loadFlow = useCallback((flow: SavedFlow) => {
    setFlowPath(flow.steps);
    setActiveFlowId(flow.id);
    setIsPathMode(true);
  }, []);

  useEffect(() => {
    if (pathStepsRef.current) {
      pathStepsRef.current.scrollLeft = pathStepsRef.current.scrollWidth;
    }
  }, [flowPath]);

  return (
    <ModeContext.Provider value={mode}>
    <div className="app-layout">
      <Sidebar
        savedFlows={savedFlows}
        activeFlowId={activeFlowId}
        onLoadFlow={loadFlow}
        onDeleteFlow={deleteFlow}
        getNodeLabel={getNodeLabel}
      />
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
            <div className="topbar-divider" />
            <button className={`topbar-tab path-toggle${isPathMode ? ' active' : ''}`} onClick={togglePathMode}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Flow Path
            </button>
          </div>
          {isPathMode && (
            <div className="path-bar">
              {flowPath.length === 0 ? (
                <span className="path-placeholder">Click nodes to build a flow path...</span>
              ) : (
                <>
                  <div className="path-steps" ref={pathStepsRef}>
                    {flowPath.map((id, i) => (
                      <span key={`${id}-${i}`} className="path-step-wrapper">
                        {i > 0 && (
                          <svg className="path-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        )}
                        <span className="path-step">{getNodeLabel(id)}</span>
                      </span>
                    ))}
                  </div>
                  <div className="path-actions">
                    <button className="path-save-btn" onClick={() => { setShowSaveForm(true); setTimeout(() => saveNameRef.current?.focus(), 0); }} title="Save flow">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                      Save
                    </button>
                    <button className="path-clear" onClick={clearPath} title="Clear path">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
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
    {showSaveForm && (
      <div className="save-form-overlay" onClick={() => setShowSaveForm(false)}>
        <div className="save-form" onClick={e => e.stopPropagation()}>
          <div className="save-form-header">Save Flow Path</div>
          <label className="save-form-label">
            Name
            <input
              ref={saveNameRef}
              className="save-form-input"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="e.g. Post a comment"
              onKeyDown={e => { if (e.key === 'Enter') saveFlow(); if (e.key === 'Escape') setShowSaveForm(false); }}
            />
          </label>
          <label className="save-form-label">
            Description
            <textarea
              className="save-form-textarea"
              value={saveDesc}
              onChange={e => setSaveDesc(e.target.value)}
              placeholder="Describe what this flow does..."
              rows={3}
              onKeyDown={e => { if (e.key === 'Escape') setShowSaveForm(false); }}
            />
          </label>
          <div className="save-form-path-preview">
            {flowPath.map((id, i) => (
              <span key={`${id}-${i}`}>
                {i > 0 && <span className="save-form-arrow">&rarr;</span>}
                <span className="path-step">{getNodeLabel(id)}</span>
              </span>
            ))}
          </div>
          <div className="save-form-actions">
            <button className="save-form-cancel" onClick={() => setShowSaveForm(false)}>Cancel</button>
            <button className="save-form-submit" onClick={saveFlow} disabled={!saveName.trim()}>Save Flow</button>
          </div>
        </div>
      </div>
    )}
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
