import {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  createContext,
  useContext,
} from "react";
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
  MiniMap,
} from "@xyflow/react";
import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeChange,
  Connection,
  Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./App.css";

import Sidebar from "./components/Sidebar";
import PropertiesPanel from "./components/PropertiesPanel";
import SystemNode from "./components/SystemNode";
import StickyNote from "./components/StickyNote";
import TextNode from "./components/TextNode";
import ContainerNode from "./components/ContainerNode";
import LabeledEdge from "./components/LabeledEdge";
import EdgePropertiesPanel from "./components/EdgePropertiesPanel";
import HotkeyHelpOverlay from "./components/HotkeyHelpOverlay";
import CapacityCalculator from "./components/CapacityCalculator";
import { useHotkeys } from "./hooks/useHotkeys";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { randomMetrics } from "./data";
import { registry } from "./registry";
import type {
  SystemNodeData,
  StickyNoteData,
  TextNodeData,
  ContainerNodeData,
  ComponentType,
  EdgeData,
  EffectiveStress,
  StressFailure,
  StressConfig,
  SavedFlow,
  StressMutation,
  StressScenario,
} from "./types";
import { computeStressEffects } from "./stressEngine";
import { instantiatePattern } from "./patterns";
import { ulid } from "ulid";
import {
  initDB,
  flushPersist,
  listDesigns,
  createDesign,
  renameDesign,
  deleteDesign,
  loadDesignState,
  saveDesignState,
  saveFlowPath,
  forkDesign,
  deleteFlowPath,
} from "./db";
import type { Design } from "./db";

type SystemFlowNode = Node<SystemNodeData, "system">;
type StickyFlowNode = Node<StickyNoteData, "sticky">;
type TextFlowNode = Node<TextNodeData, "text">;
type ContainerFlowNode = Node<ContainerNodeData, "container">;
type AppNode = SystemFlowNode | StickyFlowNode | TextFlowNode | ContainerFlowNode;

const nodeTypes = {
  system: SystemNode,
  sticky: StickyNote,
  text: TextNode,
  container: ContainerNode,
};
const edgeTypes = { labeled: LabeledEdge };

const typeCounters: Record<string, number> = {};

function generateLabel(type: ComponentType): string {
  const entry = registry.getOrDefault(type);
  const short = entry.label.toLowerCase().split(" ")[0].slice(0, 6);
  typeCounters[type] = (typeCounters[type] ?? 0) + 1;
  return `${short}-${typeCounters[type]}`;
}

export type Mode = "plan" | "stress" | "monitor" | "price";

export const ModeContext = createContext<Mode>("plan");
export function useMode() {
  return useContext(ModeContext);
}

export interface StressContextValue {
  effects: Map<string, EffectiveStress>;
  partitionedEdges: Set<string>;
  slowEdges: Set<string>;
  stressConfig: StressConfig;
}
const defaultStressConfig: StressConfig = { trafficMultiplier: 1, latencyThreshold: 500 };
export const StressContext = createContext<StressContextValue>({
  effects: new Map(),
  partitionedEdges: new Set(),
  slowEdges: new Set(),
  stressConfig: defaultStressConfig,
});
export function useStress() {
  return useContext(StressContext);
}

export type PanelPosition = "right" | "bottom";

interface CanvasProps {
  designId: string;
  designs: Design[];
  onSwitchDesign: (id: string) => void;
  onCreateDesign: () => void;
  onRenameDesign: (id: string, name: string) => void;
  onDeleteDesign: (id: string) => void;
  onForkDesign: (sourceId: string, name: string) => void;
  onStartCompare: (leftId: string, rightId: string) => void;
}

function Canvas({
  designId,
  designs,
  onSwitchDesign,
  onCreateDesign,
  onRenameDesign,
  onDeleteDesign,
  onForkDesign,
  onStartCompare,
}: CanvasProps) {
  const initialState = useMemo(() => loadDesignState(designId), [designId]);
  const currentDesign = useMemo(() => designs.find((d) => d.id === designId), [designs, designId]);

  const [nodes, setNodes] = useState<AppNode[]>(initialState.nodes as AppNode[]);
  const [edges, setEdges] = useState<Edge[]>(initialState.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("plan");
  const [panelPosition, setPanelPosition] = useState<PanelPosition>("right");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [panelWidth, setPanelWidth] = useState(340);
  const [panelHeight, setPanelHeight] = useState(260);
  const [flowPath, setFlowPath] = useState<string[]>([]);
  const [isPathMode, setIsPathMode] = useState(false);
  const [savedFlows, setSavedFlows] = useState<SavedFlow[]>(initialState.flowPaths);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [showHotkeyHelp, setShowHotkeyHelp] = useState(false);
  const [showCapacityCalc, setShowCapacityCalc] = useState(false);
  const [stressConfig, setStressConfig] = useState<StressConfig>(defaultStressConfig);
  const [stressScenarios, setStressScenarios] = useState<StressScenario[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const recordBuffer = useRef<StressMutation[]>([]);
  const recordStart = useRef(0);
  const playbackTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [showDesignMenu, setShowDesignMenu] = useState(false);
  const [editingDesignName, setEditingDesignName] = useState(false);
  const [designNameDraft, setDesignNameDraft] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const pathStepsRef = useRef<HTMLDivElement>(null);
  const saveNameRef = useRef<HTMLInputElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const clearFilterRef = useRef<(() => void) | null>(null);
  const designNameRef = useRef<HTMLInputElement>(null);
  const designMenuRef = useRef<HTMLDivElement>(null);
  const {
    screenToFlowPosition,
    zoomIn,
    zoomOut,
    fitView,
    getViewport,
    setViewport,
    getNodes: getFlowNodes,
  } = useReactFlow();

  const { takeSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo(
    nodes,
    edges,
    setNodes,
    setEdges,
  );
  const isDraggingRef = useRef(false);
  const lastDataSnapshotRef = useRef(0);

  // Restore viewport from saved state
  useEffect(() => {
    setViewport(initialState.viewport);
  }, [initialState.viewport, setViewport]);

  // Auto-save nodes and edges
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      saveDesignState(designId, nodes, edges, getViewport());
    }, 500);
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, [designId, nodes, edges, getViewport]);

  // Save viewport on pan/zoom end
  const onMoveEnd = useCallback(
    (_: unknown, viewport: Viewport) => {
      saveDesignState(designId, nodes, edges, viewport);
    },
    [designId, nodes, edges],
  );

  // Flush pending saves on unmount
  useEffect(() => {
    return () => {
      flushPersist();
    };
  }, []);

  // Close design menu on outside click
  useEffect(() => {
    if (!showDesignMenu) return;
    function handleClick(e: MouseEvent) {
      if (designMenuRef.current && !designMenuRef.current.contains(e.target as HTMLElement)) {
        setShowDesignMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDesignMenu]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const selectedEdge = useMemo(
    () =>
      (selectedEdgeId
        ? (edges.find((e) => e.id === selectedEdgeId) ?? null)
        : null) as Edge<EdgeData> | null,
    [edges, selectedEdgeId],
  );

  const onNodesChange: OnNodesChange<AppNode> = useCallback(
    (changes: NodeChange<AppNode>[]) => {
      const hasRemove = changes.some((c) => c.type === "remove");
      const hasDragStart = changes.some((c) => c.type === "position" && c.dragging);
      const hasDragEnd = changes.some((c) => c.type === "position" && !c.dragging);

      if (hasRemove || (hasDragStart && !isDraggingRef.current)) {
        takeSnapshot();
      }
      if (hasDragStart) isDraggingRef.current = true;
      if (hasDragEnd) isDraggingRef.current = false;

      setNodes((nds) => applyNodeChanges(changes, nds));
      for (const change of changes) {
        if (change.type === "remove" && change.id === selectedNodeId) {
          setSelectedNodeId(null);
        }
      }
    },
    [selectedNodeId, takeSnapshot],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (changes.some((c) => c.type === "remove")) takeSnapshot();
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [takeSnapshot],
  );

  const isValidConnection = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) return false;
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return true;
      if (sourceNode.type !== "system" || targetNode.type !== "system") return true;
      const sourceType = (sourceNode.data as SystemNodeData).componentType;
      const targetType = (targetNode.data as SystemNodeData).componentType;
      return registry.canConnect(sourceType, targetType);
    },
    [nodes],
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      takeSnapshot();
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: ulid(),
            type: "labeled",
            data: { label: "", protocol: "", format: "", partitioned: false, simulatedLatency: 0 },
          },
          eds,
        ),
      );
    },
    [takeSnapshot],
  );

  useEffect(() => {
    function handleLabelChange(e: Event) {
      const { id, label } = (e as CustomEvent).detail;
      takeSnapshot();
      setEdges((eds) =>
        eds.map((edge) => (edge.id === id ? { ...edge, data: { ...edge.data, label } } : edge)),
      );
    }
    window.addEventListener("edge-label-change", handleLabelChange);
    return () => window.removeEventListener("edge-label-change", handleLabelChange);
  }, [takeSnapshot]);

  useEffect(() => {
    function handleToggleCollapse(e: Event) {
      const { containerId } = (e as CustomEvent).detail;
      takeSnapshot();
      setNodes((nds) => {
        const container = nds.find((n) => n.id === containerId && n.type === "container");
        if (!container) return nds;

        const containerData = container.data as ContainerNodeData;
        const isCollapsed = containerData.collapsed ?? false;

        // Collect all descendant IDs
        const descendantIds = new Set<string>();
        function collectDescendants(parentId: string) {
          for (const n of nds) {
            if (n.parentId === parentId) {
              descendantIds.add(n.id);
              collectDescendants(n.id);
            }
          }
        }
        collectDescendants(containerId);

        if (isCollapsed) {
          // Expand: restore size and show children
          return nds.map((n) => {
            if (n.id === containerId) {
              return {
                ...n,
                style: {
                  ...n.style,
                  width: containerData.expandedWidth ?? n.style?.width,
                  height: containerData.expandedHeight ?? n.style?.height,
                },
                data: { ...containerData, collapsed: false },
              } as typeof n;
            }
            if (descendantIds.has(n.id)) {
              return { ...n, hidden: false } as typeof n;
            }
            return n;
          });
        } else {
          // Collapse: save size, shrink, and hide children
          const currentW =
            container.measured?.width ?? (container.style?.width as number | undefined) ?? 400;
          const currentH =
            container.measured?.height ?? (container.style?.height as number | undefined) ?? 300;

          return nds.map((n) => {
            if (n.id === containerId) {
              return {
                ...n,
                style: { ...n.style, width: 220, height: 42 },
                data: {
                  ...containerData,
                  collapsed: true,
                  expandedWidth: currentW,
                  expandedHeight: currentH,
                },
              } as typeof n;
            }
            if (descendantIds.has(n.id)) {
              return { ...n, hidden: true } as typeof n;
            }
            return n;
          });
        }
      });
    }
    window.addEventListener("container-toggle-collapse", handleToggleCollapse);
    return () => window.removeEventListener("container-toggle-collapse", handleToggleCollapse);
  }, [takeSnapshot]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/system-designer");
      if (!type) return;

      takeSnapshot();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      if (type.startsWith("pattern:")) {
        const patternId = type.slice("pattern:".length);

        // Check if drop landed on an existing system node
        const allNodes = getFlowNodes();
        const anchorNode = allNodes.find((n) => {
          if (n.type !== "system") return false;
          const w = n.measured?.width ?? n.width ?? 180;
          const h = n.measured?.height ?? n.height ?? 50;
          return (
            position.x >= n.position.x &&
            position.x <= n.position.x + w &&
            position.y >= n.position.y &&
            position.y <= n.position.y + h
          );
        });

        const anchor = anchorNode
          ? {
              id: anchorNode.id,
              componentType: (anchorNode.data as SystemNodeData).componentType,
              position: anchorNode.position,
            }
          : undefined;

        const { nodes: newNodes, edges: newEdges } = instantiatePattern(
          patternId,
          position,
          generateLabel,
          anchor,
        );
        if (newNodes.length > 0) {
          setNodes((nds) => [...nds, ...(newNodes as AppNode[])]);
          setEdges((eds) => [...eds, ...newEdges]);
        }
        clearFilterRef.current?.();
        return;
      }

      if (type === "sticky") {
        const w = 200,
          h = 150;
        const newNode: StickyFlowNode = {
          id: ulid(),
          type: "sticky",
          position: { x: position.x - w / 2, y: position.y - h / 2 },
          style: { width: w, height: h },
          data: { text: "", color: "#fde68a" },
        };
        setNodes((nds) => [...nds, newNode]);
      } else if (type === "text") {
        const w = 260,
          h = 40;
        const newNode: TextFlowNode = {
          id: ulid(),
          type: "text",
          position: { x: position.x - w / 2, y: position.y - h / 2 },
          style: { width: w, height: h },
          data: { text: "", size: "large" },
        };
        setNodes((nds) => [...nds, newNode]);
      } else if (type === "container") {
        const w = 400,
          h = 300;
        const newNode: ContainerFlowNode = {
          id: ulid(),
          type: "container",
          zIndex: -1,
          position: { x: position.x - w / 2, y: position.y - h / 2 },
          style: { width: w, height: h },
          data: { label: "Container", color: "rgba(99,102,241,0.04)", collapsed: false },
        };
        setNodes((nds) => [...nds, newNode]);
      } else {
        const w = 180,
          h = 50;
        const newNode: SystemFlowNode = {
          id: ulid(),
          type: "system",
          position: { x: position.x - w / 2, y: position.y - h / 2 },
          data: {
            label: generateLabel(type as ComponentType),
            componentType: type as ComponentType,
            status: "healthy",
            metrics: randomMetrics(),
            plan: {},
            sharded: false,
            shardKey: "",
            endpoints: [],
            capClassification: "",
            stressFailure: "none",
            capacityPercent: 100,
            consumerRate: 1000,
          },
        };
        setNodes((nds) => [...nds, newNode]);
      }

      clearFilterRef.current?.();
    },
    [screenToFlowPosition, takeSnapshot],
  );

  const onUpdateNodeData = useCallback(
    (id: string, partial: Partial<SystemNodeData>) => {
      const now = Date.now();
      if (now - lastDataSnapshotRef.current > 500) {
        takeSnapshot();
        lastDataSnapshotRef.current = now;
      }
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? ({ ...n, data: { ...n.data, ...partial } } as typeof n) : n)),
      );
    },
    [takeSnapshot],
  );

  const onUpdateEdgeData = useCallback(
    (id: string, partial: Partial<EdgeData>) => {
      const now = Date.now();
      if (now - lastDataSnapshotRef.current > 500) {
        takeSnapshot();
        lastDataSnapshotRef.current = now;
      }
      setEdges((eds) =>
        eds.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...partial } } : e)),
      );
    },
    [takeSnapshot],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: AppNode) => {
      if (isPathMode && node.type === "system") {
        setFlowPath((prev) => {
          if (prev.length > 0 && prev[prev.length - 1] === node.id) {
            return prev.slice(0, -1);
          }
          return [...prev, node.id];
        });
        return;
      }
      if (mode === "stress" && node.type === "system") {
        const data = node.data as SystemNodeData;
        const cycle: StressFailure[] = ["none", "overloaded", "down"];
        const nextIdx = (cycle.indexOf(data.stressFailure || "none") + 1) % cycle.length;
        onUpdateNodeDataR(node.id, { stressFailure: cycle[nextIdx] });
      }
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
    },
    [isPathMode, mode, onUpdateNodeDataR],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (mode === "stress") {
        const edgeData = edge.data as EdgeData | undefined;
        onUpdateEdgeDataR(edge.id, { partitioned: !edgeData?.partitioned });
      }
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
    },
    [mode, onUpdateEdgeDataR],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const togglePanelPosition = useCallback(() => {
    setPanelPosition((prev) => (prev === "right" ? "bottom" : "right"));
  }, []);

  const clearCanvas = useCallback(() => {
    takeSnapshot();
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    Object.keys(typeCounters).forEach((k) => delete typeCounters[k]);
  }, [takeSnapshot]);

  const connectionCount = edges.length;

  const stressEffects = useMemo(() => {
    if (mode !== "stress") return new Map<string, EffectiveStress>();
    const systemNodes = nodes.filter(
      (n): n is Node<SystemNodeData, "system"> => n.type === "system",
    );
    return computeStressEffects(systemNodes, edges, stressConfig);
  }, [mode, nodes, edges, stressConfig]);

  const partitionedEdges = useMemo(() => {
    const set = new Set<string>();
    if (mode !== "stress") return set;
    for (const edge of edges) {
      if ((edge.data as EdgeData | undefined)?.partitioned) set.add(edge.id);
    }
    return set;
  }, [mode, edges]);

  const slowEdges = useMemo(() => {
    const set = new Set<string>();
    if (mode !== "stress") return set;
    for (const edge of edges) {
      const d = edge.data as EdgeData | undefined;
      if (d && d.simulatedLatency > stressConfig.latencyThreshold) set.add(edge.id);
    }
    return set;
  }, [mode, edges, stressConfig.latencyThreshold]);

  const stressCtx = useMemo<StressContextValue>(
    () => ({ effects: stressEffects, partitionedEdges, slowEdges, stressConfig }),
    [stressEffects, partitionedEdges, slowEdges, stressConfig],
  );

  const resetStress = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.type === "system"
          ? ({
              ...n,
              data: {
                ...n.data,
                stressFailure: "none",
                capacityPercent: 100,
                consumerRate: 1000,
              },
            } as typeof n)
          : n,
      ),
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: { ...e.data, partitioned: false, simulatedLatency: 0 },
      })),
    );
    setStressConfig(defaultStressConfig);
  }, []);

  // --- Stress recording ---

  const recordMutation = useCallback(
    (mutation: Omit<StressMutation, "timestamp">) => {
      if (!isRecording) return;
      recordBuffer.current.push({
        ...mutation,
        timestamp: Date.now() - recordStart.current,
      });
    },
    [isRecording],
  );

  const onUpdateNodeDataR = useCallback(
    (id: string, partial: Partial<SystemNodeData>) => {
      recordMutation({ type: "node", targetId: id, data: partial as Record<string, unknown> });
      onUpdateNodeData(id, partial);
    },
    [onUpdateNodeData, recordMutation],
  );

  const onUpdateEdgeDataR = useCallback(
    (id: string, partial: Partial<EdgeData>) => {
      recordMutation({ type: "edge", targetId: id, data: partial as Record<string, unknown> });
      onUpdateEdgeData(id, partial);
    },
    [onUpdateEdgeData, recordMutation],
  );

  const setStressConfigR = useCallback(
    (updater: (prev: StressConfig) => StressConfig) => {
      setStressConfig((prev) => {
        const next = updater(prev);
        recordMutation({ type: "config", data: next as unknown as Record<string, unknown> });
        return next;
      });
    },
    [recordMutation],
  );

  const resetStressR = useCallback(() => {
    recordMutation({ type: "reset", data: {} });
    resetStress();
  }, [resetStress, recordMutation]);

  const startRecording = useCallback(() => {
    resetStress();
    recordBuffer.current = [];
    recordStart.current = Date.now();
    setIsRecording(true);
  }, [resetStress]);

  const stopRecording = useCallback((name: string) => {
    setIsRecording(false);
    if (recordBuffer.current.length === 0) return;
    const scenario: StressScenario = {
      id: ulid(),
      name,
      mutations: recordBuffer.current,
      duration: Date.now() - recordStart.current,
    };
    setStressScenarios((prev) => [...prev, scenario]);
    recordBuffer.current = [];
  }, []);

  const playScenario = useCallback(
    (scenario: StressScenario) => {
      resetStress();
      setIsPlaying(true);
      const timers: ReturnType<typeof setTimeout>[] = [];
      for (const mutation of scenario.mutations) {
        timers.push(
          setTimeout(() => {
            if (mutation.type === "node" && mutation.targetId) {
              onUpdateNodeData(mutation.targetId, mutation.data as Partial<SystemNodeData>);
            } else if (mutation.type === "edge" && mutation.targetId) {
              onUpdateEdgeData(mutation.targetId, mutation.data as Partial<EdgeData>);
            } else if (mutation.type === "config") {
              setStressConfig(mutation.data as unknown as StressConfig);
            } else if (mutation.type === "reset") {
              resetStress();
            }
          }, mutation.timestamp),
        );
      }
      timers.push(
        setTimeout(() => {
          setIsPlaying(false);
        }, scenario.duration + 100),
      );
      playbackTimers.current = timers;
    },
    [resetStress, onUpdateNodeData, onUpdateEdgeData],
  );

  const stopPlayback = useCallback(() => {
    for (const t of playbackTimers.current) clearTimeout(t);
    playbackTimers.current = [];
    setIsPlaying(false);
  }, []);

  const deleteScenario = useCallback((id: string) => {
    setStressScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const togglePathMode = useCallback(() => {
    setIsPathMode((prev) => {
      if (!prev) setFlowPath([]);
      return !prev;
    });
  }, []);

  const clearPath = useCallback(() => {
    setFlowPath([]);
    setActiveFlowId(null);
  }, []);

  const hotkeyActions = useMemo<Record<string, () => void>>(
    () => ({
      "mode-plan": () => setMode("plan"),
      "mode-stress": () => setMode("stress"),
      "mode-monitor": () => setMode("monitor"),
      "mode-price": () => setMode("price"),

      undo: () => undo(),
      redo: () => redo(),
      "zoom-in": () => zoomIn(),
      "zoom-out": () => zoomOut(),
      "zoom-fit": () => fitView({ padding: 0.2 }),
      "clear-canvas": () => clearCanvas(),
      "select-all": () => setNodes((nds) => nds.map((n) => ({ ...n, selected: true }))),

      "toggle-path": () => togglePathMode(),
      "save-path": () => {
        if (isPathMode && flowPath.length > 0) {
          setShowSaveForm(true);
          setTimeout(() => saveNameRef.current?.focus(), 0);
        }
      },
      "clear-path": () => {
        if (isPathMode) clearPath();
      },

      "close-or-deselect": () => {
        if (showCapacityCalc) {
          setShowCapacityCalc(false);
          return;
        }
        if (showHotkeyHelp) {
          setShowHotkeyHelp(false);
          return;
        }
        if (showSaveForm) {
          setShowSaveForm(false);
          return;
        }
        if (selectedNodeId || selectedEdgeId) {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        }
      },
      "toggle-dock": () => {
        if (selectedNodeId || selectedEdgeId) togglePanelPosition();
      },
      "toggle-sidebar": () => setSidebarCollapsed((prev) => !prev),

      "add-sticky": () => {
        takeSnapshot();
        const vp = getViewport();
        const cx = (window.innerWidth / 2 - vp.x) / vp.zoom;
        const cy = (window.innerHeight / 2 - vp.y) / vp.zoom;
        const node: StickyFlowNode = {
          id: ulid(),
          type: "sticky",
          position: { x: cx - 100, y: cy - 75 },
          style: { width: 200, height: 150 },
          data: { text: "", color: "#fde68a" },
        };
        setNodes((nds) => [...nds, node]);
      },
      "add-text": () => {
        takeSnapshot();
        const vp = getViewport();
        const cx = (window.innerWidth / 2 - vp.x) / vp.zoom;
        const cy = (window.innerHeight / 2 - vp.y) / vp.zoom;
        const node: TextFlowNode = {
          id: ulid(),
          type: "text",
          position: { x: cx - 130, y: cy - 20 },
          style: { width: 260, height: 40 },
          data: { text: "", size: "large" },
        };
        setNodes((nds) => [...nds, node]);
      },

      "show-help": () => setShowHotkeyHelp((prev) => !prev),
      "show-capacity-calc": () => setShowCapacityCalc((prev) => !prev),
      "focus-filter": () => {
        if (sidebarCollapsed) setSidebarCollapsed(false);
        setTimeout(() => filterInputRef.current?.focus(), 0);
      },
    }),
    [
      takeSnapshot,
      undo,
      redo,
      zoomIn,
      zoomOut,
      fitView,
      getViewport,
      clearCanvas,
      togglePathMode,
      clearPath,
      togglePanelPosition,
      isPathMode,
      flowPath.length,
      showHotkeyHelp,
      showCapacityCalc,
      showSaveForm,
      selectedNodeId,
      selectedEdgeId,
      sidebarCollapsed,
    ],
  );

  useHotkeys(hotkeyActions);

  const getNodeLabel = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (!node || node.type !== "system") return id;
      return (node.data as SystemNodeData).label;
    },
    [nodes],
  );

  const saveFlow = useCallback(() => {
    if (!saveName.trim() || flowPath.length === 0) return;
    const flow: SavedFlow = {
      id: ulid(),
      name: saveName.trim(),
      description: saveDesc.trim(),
      steps: [...flowPath],
    };
    saveFlowPath(designId, flow);
    setSavedFlows((prev) => [...prev, flow]);
    setShowSaveForm(false);
    setSaveName("");
    setSaveDesc("");
    setActiveFlowId(flow.id);
  }, [saveName, saveDesc, flowPath, designId]);

  const deleteFlow = useCallback(
    (id: string) => {
      deleteFlowPath(id);
      setSavedFlows((prev) => prev.filter((f) => f.id !== id));
      if (activeFlowId === id) setActiveFlowId(null);
    },
    [activeFlowId],
  );

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

  const startResize = useCallback(
    (e: React.PointerEvent, axis: "x" | "y", onMove: (delta: number) => void) => {
      e.preventDefault();
      const startPos = axis === "x" ? e.clientX : e.clientY;
      const onPointerMove = (ev: PointerEvent) => {
        const current = axis === "x" ? ev.clientX : ev.clientY;
        onMove(current - startPos);
      };
      const onPointerUp = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [],
  );

  const onSidebarResizeStart = useCallback(
    (e: React.PointerEvent) => {
      const initial = sidebarWidth;
      startResize(e, "x", (delta) => {
        setSidebarWidth(Math.max(180, Math.min(400, initial + delta)));
      });
    },
    [sidebarWidth, startResize],
  );

  const onPanelResizeStartX = useCallback(
    (e: React.PointerEvent) => {
      const initial = panelWidth;
      startResize(e, "x", (delta) => {
        setPanelWidth(Math.max(260, Math.min(600, initial - delta)));
      });
    },
    [panelWidth, startResize],
  );

  const onPanelResizeStartY = useCallback(
    (e: React.PointerEvent) => {
      const initial = panelHeight;
      const maxH = window.innerHeight * 0.7;
      startResize(e, "y", (delta) => {
        setPanelHeight(Math.max(150, Math.min(maxH, initial - delta)));
      });
    },
    [panelHeight, startResize],
  );

  const showPanel =
    (selectedNode && (selectedNode.type === "system" || selectedNode.type === "container")) ||
    selectedEdge;

  return (
    <ModeContext.Provider value={mode}>
      <StressContext.Provider value={stressCtx}>
        <div className="flex w-full h-full">
          <Sidebar
            savedFlows={savedFlows}
            activeFlowId={activeFlowId}
            onLoadFlow={loadFlow}
            onDeleteFlow={deleteFlow}
            getNodeLabel={getNodeLabel}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
            width={sidebarCollapsed ? undefined : sidebarWidth}
            filterInputRef={filterInputRef}
            clearFilterRef={clearFilterRef}
          />
          {!sidebarCollapsed && (
            <div
              className="w-[5px] cursor-col-resize shrink-0 relative z-20 bg-transparent transition-colors duration-150 hover:bg-accent active:bg-accent"
              onPointerDown={onSidebarResizeStart}
            />
          )}
          <div
            className={`flex-1 flex min-w-0 min-h-0${panelPosition === "bottom" ? " flex-col" : ""}`}
          >
            <div className="flex-1 flex flex-col relative min-w-0 min-h-0" ref={canvasRef}>
              <header className="flex items-center justify-between px-5 h-[52px] bg-surface border-b border-border z-5 shrink-0">
                <div className="flex items-center gap-5">
                  <div className="relative" ref={designMenuRef}>
                    {editingDesignName ? (
                      <input
                        ref={designNameRef}
                        className="text-sm font-semibold text-text-bright bg-surface-2 border border-accent rounded-md px-2 py-1 outline-none w-[200px]"
                        value={designNameDraft}
                        onChange={(e) => setDesignNameDraft(e.target.value)}
                        onBlur={() => {
                          if (designNameDraft.trim()) {
                            onRenameDesign(designId, designNameDraft.trim());
                          }
                          setEditingDesignName(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (designNameDraft.trim()) {
                              onRenameDesign(designId, designNameDraft.trim());
                            }
                            setEditingDesignName(false);
                          }
                          if (e.key === "Escape") setEditingDesignName(false);
                        }}
                      />
                    ) : (
                      <button
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-semibold text-text-bright bg-transparent cursor-pointer transition-colors duration-150 max-w-[240px] whitespace-nowrap overflow-hidden text-ellipsis hover:bg-surface-2"
                        onDoubleClick={() => {
                          setDesignNameDraft(currentDesign?.name ?? "");
                          setEditingDesignName(true);
                          setTimeout(() => designNameRef.current?.select(), 0);
                        }}
                        onClick={() => setShowDesignMenu((p) => !p)}
                        title="Click to switch designs, double-click to rename"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                          <polyline points="13 2 13 9 20 9" />
                        </svg>
                        {currentDesign?.name ?? "Untitled"}
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    )}
                    {showDesignMenu && (
                      <div className="absolute top-[calc(100%+4px)] left-0 min-w-[220px] bg-surface border border-border rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-[100] p-1 max-h-[320px] overflow-y-auto">
                        <div className="text-[11px] font-semibold uppercase text-text-dim px-2.5 pt-1.5 pb-1 tracking-wide">
                          Designs
                        </div>
                        {designs.map((d) => (
                          <div
                            key={d.id}
                            className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] cursor-pointer text-[13px] text-text transition-colors duration-100 hover:bg-surface-2${d.id === designId ? " text-accent font-semibold" : ""}`}
                            onClick={() => {
                              if (d.id !== designId) {
                                saveDesignState(designId, nodes, edges, getViewport());
                                flushPersist();
                                onSwitchDesign(d.id);
                              }
                              setShowDesignMenu(false);
                            }}
                          >
                            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                              {d.name}
                            </span>
                            {d.id !== designId && designs.length > 1 && (
                              <button
                                className="opacity-0 text-text-dim p-0.5 rounded transition-all duration-100 shrink-0 group-hover:opacity-100 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteDesign(d.id);
                                }}
                                title="Delete design"
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                        <div className="h-px bg-border mx-1.5 my-1" />
                        <div
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] cursor-pointer text-[13px] transition-colors duration-100 hover:bg-surface-2 text-accent font-medium"
                          onClick={() => {
                            saveDesignState(designId, nodes, edges, getViewport());
                            flushPersist();
                            onCreateDesign();
                            setShowDesignMenu(false);
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          New Design
                        </div>
                        <div
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] cursor-pointer text-[13px] transition-colors duration-100 hover:bg-surface-2 text-text font-medium"
                          onClick={() => {
                            saveDesignState(designId, nodes, edges, getViewport());
                            flushPersist();
                            const name = currentDesign
                              ? `${currentDesign.name} (fork)`
                              : "Fork";
                            onForkDesign(designId, name);
                            setShowDesignMenu(false);
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="18" r="3" />
                            <circle cx="6" cy="6" r="3" />
                            <circle cx="18" cy="6" r="3" />
                            <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
                            <path d="M12 12v3" />
                          </svg>
                          Fork Design
                        </div>
                        {designs.length > 1 && (
                          <>
                            <div className="h-px bg-border mx-1.5 my-1" />
                            <div className="px-2 py-1 text-[11px] font-semibold uppercase text-text-dim tracking-wide">
                              Compare with
                            </div>
                            {designs
                              .filter((d) => d.id !== designId)
                              .slice(0, 5)
                              .map((d) => (
                                <div
                                  key={d.id}
                                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] cursor-pointer text-[13px] transition-colors duration-100 hover:bg-surface-2 text-text"
                                  onClick={() => {
                                    saveDesignState(designId, nodes, edges, getViewport());
                                    flushPersist();
                                    onStartCompare(designId, d.id);
                                    setShowDesignMenu(false);
                                  }}
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <rect x="3" y="3" width="7" height="18" rx="1" />
                                    <rect x="14" y="3" width="7" height="18" rx="1" />
                                  </svg>
                                  {d.name}
                                </div>
                              ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <nav className="flex gap-0.5 bg-surface-2 rounded-lg p-[3px]">
                    <button
                      className={`flex items-center gap-[5px] px-3.5 py-[5px] rounded-md text-[13px] font-medium text-text-dim transition-all duration-150 hover:text-text-bright hover:bg-surface-3${mode === "plan" ? " text-white bg-accent" : ""}`}
                      onClick={() => setMode("plan")}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      Plan
                    </button>
                    <button
                      className={`flex items-center gap-[5px] px-3.5 py-[5px] rounded-md text-[13px] font-medium text-text-dim transition-all duration-150 hover:text-text-bright hover:bg-surface-3${mode === "stress" ? " text-white bg-accent" : ""}`}
                      onClick={() => setMode("stress")}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                      Stress
                    </button>
                    <button
                      className={`flex items-center gap-[5px] px-3.5 py-[5px] rounded-md text-[13px] font-medium text-text-dim transition-all duration-150 hover:text-text-bright hover:bg-surface-3${mode === "monitor" ? " text-white bg-accent" : ""}`}
                      onClick={() => setMode("monitor")}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                      Monitor
                    </button>
                    <button
                      className={`flex items-center gap-[5px] px-3.5 py-[5px] rounded-md text-[13px] font-medium text-text-dim transition-all duration-150 hover:text-text-bright hover:bg-surface-3${mode === "price" ? " text-white bg-accent" : ""}`}
                      onClick={() => setMode("price")}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                      </svg>
                      Price
                    </button>
                  </nav>
                  <div className="w-px h-6 bg-border shrink-0" />
                  <button
                    className={`flex items-center gap-[5px] px-3.5 py-[5px] rounded-md text-[13px] font-medium text-text-dim transition-all duration-150 hover:text-text-bright hover:bg-surface-3 bg-surface-2 shrink-0${isPathMode ? " text-white bg-accent" : ""}`}
                    onClick={togglePathMode}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    Flow Path
                  </button>
                  {mode === "stress" && (
                    <>
                      <div className="flex items-center gap-1 px-1 py-0.5 rounded-lg bg-surface-2">
                        {([1, 2, 5, 10] as const).map((m) => (
                          <button
                            key={m}
                            className={`px-2.5 py-[3px] rounded-md text-[12px] font-semibold transition-all duration-150 cursor-pointer${
                              stressConfig.trafficMultiplier === m
                                ? " bg-accent text-white"
                                : " text-text-dim hover:text-text-bright hover:bg-surface-3"
                            }`}
                            onClick={() =>
                              setStressConfigR((c) => ({ ...c, trafficMultiplier: m }))
                            }
                          >
                            {m}x
                          </button>
                        ))}
                      </div>
                      <button
                        className="flex items-center gap-[5px] px-3.5 py-[5px] rounded-lg text-[13px] font-medium text-text-dim transition-all duration-150 hover:text-text-bright hover:bg-surface-3 bg-surface-2"
                        onClick={resetStressR}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 12a9 9 0 109-9M3 3v9h9" />
                        </svg>
                        Reset
                      </button>
                      {isRecording ? (
                        <button
                          className="flex items-center gap-[5px] px-3.5 py-[5px] rounded-lg text-[13px] font-medium text-white bg-[#ef4444] transition-all duration-150 hover:bg-[#dc2626] animate-pulse"
                          onClick={() => {
                            const name = prompt("Scenario name:");
                            if (name) stopRecording(name);
                            else setIsRecording(false);
                          }}
                        >
                          <span className="w-2 h-2 rounded-full bg-white" />
                          Stop
                        </button>
                      ) : isPlaying ? (
                        <button
                          className="flex items-center gap-[5px] px-3.5 py-[5px] rounded-lg text-[13px] font-medium text-accent bg-accent-bg transition-all duration-150 hover:bg-surface-3"
                          onClick={stopPlayback}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            stroke="none"
                          >
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                          Stop
                        </button>
                      ) : (
                        <>
                          <button
                            className="flex items-center gap-[5px] px-3.5 py-[5px] rounded-lg text-[13px] font-medium text-text-dim transition-all duration-150 hover:text-text-bright hover:bg-surface-3 bg-surface-2"
                            onClick={startRecording}
                            title="Record stress scenario"
                          >
                            <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                            Record
                          </button>
                          {stressScenarios.length > 0 && (
                            <div className="relative group">
                              <button className="flex items-center gap-[5px] px-3.5 py-[5px] rounded-lg text-[13px] font-medium text-text-dim transition-all duration-150 hover:text-text-bright hover:bg-surface-3 bg-surface-2">
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  stroke="none"
                                >
                                  <polygon points="5,3 19,12 5,21" />
                                </svg>
                                Scenarios
                              </button>
                              <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[180px] hidden group-hover:block z-50">
                                {stressScenarios.map((s) => (
                                  <div
                                    key={s.id}
                                    className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-surface-2 cursor-pointer"
                                  >
                                    <button
                                      className="flex-1 text-left text-[13px] text-text-bright"
                                      onClick={() => playScenario(s)}
                                    >
                                      {s.name}
                                      <span className="text-text-dim ml-1.5 text-[11px]">
                                        {(s.duration / 1000).toFixed(1)}s
                                      </span>
                                    </button>
                                    <button
                                      className="w-5 h-5 flex items-center justify-center rounded text-text-dim hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.12)]"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteScenario(s.id);
                                      }}
                                    >
                                      <svg
                                        width="10"
                                        height="10"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      >
                                        <path d="M18 6L6 18M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-0.5">
                    <button
                      className="flex items-center justify-center w-8 h-8 rounded-lg text-text-dim transition-all duration-150 hover:bg-surface-2 hover:text-text-bright disabled:opacity-30 disabled:pointer-events-none"
                      onClick={undo}
                      disabled={!canUndo}
                      title="Undo (⌘Z)"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 7v6h6" />
                        <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6.69 3L3 13" />
                      </svg>
                    </button>
                    <button
                      className="flex items-center justify-center w-8 h-8 rounded-lg text-text-dim transition-all duration-150 hover:bg-surface-2 hover:text-text-bright disabled:opacity-30 disabled:pointer-events-none"
                      onClick={redo}
                      disabled={!canRedo}
                      title="Redo (⌘⇧Z)"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 7v6h-6" />
                        <path d="M3 17a9 9 0 019-9 9 9 0 016.69 3L21 13" />
                      </svg>
                    </button>
                  </div>
                  <button
                    className={`flex items-center justify-center w-8 h-8 rounded-lg text-text-dim transition-all duration-150 hover:bg-surface-2 hover:text-text-bright${showCapacityCalc ? " text-accent bg-accent-bg" : ""}`}
                    onClick={() => setShowCapacityCalc((prev) => !prev)}
                    title="Capacity Calculator (C)"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="4" y="2" width="16" height="20" rx="2" />
                      <line x1="8" y1="6" x2="16" y2="6" />
                      <line x1="8" y1="10" x2="10" y2="10" />
                      <line x1="12" y1="10" x2="14" y2="10" />
                      <line x1="8" y1="14" x2="10" y2="14" />
                      <line x1="12" y1="14" x2="14" y2="14" />
                      <line x1="8" y1="18" x2="14" y2="18" />
                    </svg>
                  </button>
                  <span className="flex items-center gap-1.5 text-[13px] text-text-dim">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                    {nodes.length} nodes
                  </span>
                  <span className="flex items-center gap-1.5 text-[13px] text-text-dim">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                    {connectionCount} connections
                  </span>
                  <button
                    className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg bg-surface-2 border border-border text-text text-[13px] font-medium transition-all duration-150 hover:bg-surface-3 hover:text-text-bright"
                    onClick={clearCanvas}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                    Clear Canvas
                  </button>
                </div>
              </header>
              {isPathMode && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-surface-2 border-b border-border shrink-0 overflow-hidden">
                  {flowPath.length === 0 ? (
                    <span className="text-xs text-text-dim whitespace-nowrap">
                      Click nodes to build a flow path...
                    </span>
                  ) : (
                    <>
                      <div
                        className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-hide"
                        ref={pathStepsRef}
                      >
                        {flowPath.map((id, i) => (
                          <span key={`${id}-${i}`} className="flex items-center gap-0.5 shrink-0">
                            {i > 0 && (
                              <svg
                                className="text-text-dim shrink-0"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            )}
                            <span className="text-xs font-medium text-text-bright bg-surface-3 px-2.5 py-[3px] rounded whitespace-nowrap">
                              {getNodeLabel(id)}
                            </span>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          className="flex items-center gap-[5px] px-2.5 py-[3px] rounded text-xs font-medium text-accent bg-transparent transition-all duration-150 whitespace-nowrap hover:bg-accent-bg"
                          onClick={() => {
                            setShowSaveForm(true);
                            setTimeout(() => saveNameRef.current?.focus(), 0);
                          }}
                          title="Save flow"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                          </svg>
                          Save
                        </button>
                        <button
                          className="flex items-center justify-center w-[22px] h-[22px] rounded text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-3 hover:text-text-bright"
                          onClick={clearPath}
                          title="Clear path"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: "labeled" }}
                isValidConnection={isValidConnection}
                connectionMode={ConnectionMode.Loose}
                onMoveEnd={onMoveEnd}
                fitView={false}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                proOptions={{ hideAttribution: true }}
                edgesReconnectable
                deleteKeyCode={["Delete", "Backspace"]}
                className="flex-1"
              >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a2b35" />
                <MiniMap
                  nodeStrokeWidth={3}
                  nodeColor={(n) => {
                    if (n.type === "sticky") return "#fde68a";
                    if (n.type === "text") return "var(--text-dim)";
                    if (n.type === "container") return "var(--border)";
                    const entry = registry.get((n.data as SystemNodeData).componentType);
                    return entry?.color ?? "var(--accent)";
                  }}
                  maskColor="rgba(0,0,0,0.5)"
                />
              </ReactFlow>
            </div>
            {showPanel && (
              <div
                className={
                  panelPosition === "bottom"
                    ? "h-[5px] cursor-row-resize shrink-0 relative z-20 bg-transparent transition-colors duration-150 hover:bg-accent active:bg-accent"
                    : "w-[5px] cursor-col-resize shrink-0 relative z-20 bg-transparent transition-colors duration-150 hover:bg-accent active:bg-accent"
                }
                onPointerDown={
                  panelPosition === "bottom" ? onPanelResizeStartY : onPanelResizeStartX
                }
              />
            )}
            {selectedNode && selectedNode.type === "system" && (
              <PropertiesPanel
                node={selectedNode as SystemFlowNode}
                mode={mode}
                onUpdate={onUpdateNodeDataR}
                onClose={() => setSelectedNodeId(null)}
                panelPosition={panelPosition}
                onTogglePanelPosition={togglePanelPosition}
                stressEffect={stressEffects.get(selectedNode.id)}
                size={panelPosition === "bottom" ? panelHeight : panelWidth}
              />
            )}
            {selectedNode && selectedNode.type === "container" && (
              <aside
                className={`${panelPosition === "bottom" ? "w-auto min-w-0 h-[260px] min-h-[150px] max-h-[70vh] border-l-0 border-t" : "w-[340px] min-w-[340px] border-l"} bg-surface border-border flex flex-col z-10 overflow-y-auto`}
                style={
                  panelPosition === "bottom"
                    ? { height: panelHeight }
                    : { width: panelWidth, minWidth: panelWidth }
                }
              >
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border shrink-0">
                  <h2 className="text-base font-bold text-text-bright">Container</h2>
                  <div className="flex items-center gap-1">
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim transition-all duration-150 hover:bg-surface-2 hover:text-text-bright"
                      onClick={togglePanelPosition}
                      title={panelPosition === "right" ? "Dock to bottom" : "Dock to right"}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {panelPosition === "right" ? (
                          <>
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="15" x2="21" y2="15" />
                          </>
                        ) : (
                          <>
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="15" y1="3" x2="15" y2="21" />
                          </>
                        )}
                      </svg>
                    </button>
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-md text-lg text-text-dim transition-all duration-150 hover:bg-surface-2 hover:text-text-bright"
                      onClick={() => setSelectedNodeId(null)}
                    >
                      &times;
                    </button>
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-text-dim">Label</label>
                    <input
                      className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-bright text-sm outline-none transition-[border-color] duration-150 focus:border-accent"
                      value={(selectedNode.data as ContainerNodeData).label}
                      onChange={(e) =>
                        onUpdateNodeData(selectedNode.id, {
                          label: e.target.value,
                        } as Partial<SystemNodeData>)
                      }
                    />
                  </div>
                </div>
              </aside>
            )}
            {selectedEdge && (
              <EdgePropertiesPanel
                edge={selectedEdge}
                sourceLabel={getNodeLabel(selectedEdge.source)}
                targetLabel={getNodeLabel(selectedEdge.target)}
                onUpdate={onUpdateEdgeDataR}
                onClose={() => setSelectedEdgeId(null)}
                panelPosition={panelPosition}
                onTogglePanelPosition={togglePanelPosition}
                mode={mode}
                size={panelPosition === "bottom" ? panelHeight : panelWidth}
              />
            )}
          </div>
        </div>
        {showSaveForm && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
            onClick={() => setShowSaveForm(false)}
          >
            <div
              className="bg-surface border border-border rounded-xl p-6 w-[420px] max-w-[90vw] shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-base font-bold text-text-bright mb-5">Save Flow Path</div>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-text-dim mb-3.5">
                Name
                <input
                  ref={saveNameRef}
                  className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm outline-none transition-[border-color] duration-150 focus:border-accent"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Post a comment"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveFlow();
                    if (e.key === "Escape") setShowSaveForm(false);
                  }}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-text-dim mb-3.5">
                Description
                <textarea
                  className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-[13px] font-sans outline-none resize-y transition-[border-color] duration-150 focus:border-accent"
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  placeholder="Describe what this flow does..."
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowSaveForm(false);
                  }}
                />
              </label>
              <div className="flex items-center gap-1 flex-wrap px-3 py-2.5 bg-surface-2 rounded-lg mb-5">
                {flowPath.map((id, i) => (
                  <span key={`${id}-${i}`}>
                    {i > 0 && <span className="text-text-dim text-xs mx-0.5">&rarr;</span>}
                    <span className="text-xs font-medium text-text-bright bg-surface-3 px-2.5 py-[3px] rounded whitespace-nowrap">
                      {getNodeLabel(id)}
                    </span>
                  </span>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-text bg-surface-2 border border-border transition-all duration-150 hover:bg-surface-3 hover:text-text-bright"
                  onClick={() => setShowSaveForm(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-accent transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={saveFlow}
                  disabled={!saveName.trim()}
                >
                  Save Flow
                </button>
              </div>
            </div>
          </div>
        )}
        <HotkeyHelpOverlay open={showHotkeyHelp} onClose={() => setShowHotkeyHelp(false)} />
        <CapacityCalculator open={showCapacityCalc} onClose={() => setShowCapacityCalc(false)} />
      </StressContext.Provider>
    </ModeContext.Provider>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [designId, setDesignId] = useState<string | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);

  useEffect(() => {
    initDB().then(() => {
      let all = listDesigns();
      if (all.length === 0) {
        createDesign("Untitled Design");
        all = listDesigns();
      }
      setDesigns(all);
      setDesignId(all[0].id);
      setDbReady(true);
    });
  }, []);

  const refreshDesigns = useCallback(() => setDesigns(listDesigns()), []);

  const handleCreate = useCallback(() => {
    const design = createDesign("Untitled Design");
    refreshDesigns();
    setDesignId(design.id);
  }, [refreshDesigns]);

  const handleRename = useCallback(
    (id: string, name: string) => {
      renameDesign(id, name);
      refreshDesigns();
    },
    [refreshDesigns],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteDesign(id);
      const remaining = listDesigns();
      if (remaining.length === 0) {
        const design = createDesign("Untitled Design");
        setDesigns(listDesigns());
        setDesignId(design.id);
      } else {
        setDesigns(remaining);
        if (designId === id) setDesignId(remaining[0].id);
      }
    },
    [designId],
  );

  const handleFork = useCallback(
    (sourceId: string, name: string) => {
      const forked = forkDesign(sourceId, name);
      refreshDesigns();
      setDesignId(forked.id);
    },
    [refreshDesigns],
  );

  const handleStartCompare = useCallback((leftId: string, rightId: string) => {
    setCompareIds([leftId, rightId]);
  }, []);

  // Flush to OPFS on page unload
  useEffect(() => {
    const onBeforeUnload = () => flushPersist();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  if (!dbReady || !designId) {
    return null;
  }

  if (compareIds) {
    const leftDesign = designs.find((d) => d.id === compareIds[0]);
    const rightDesign = designs.find((d) => d.id === compareIds[1]);
    const leftState = loadDesignState(compareIds[0]);
    const rightState = loadDesignState(compareIds[1]);

    return (
      <div className="flex flex-col h-screen bg-surface text-text">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-3">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
            >
              <rect x="3" y="3" width="7" height="18" rx="1" />
              <rect x="14" y="3" width="7" height="18" rx="1" />
            </svg>
            <span className="text-sm font-semibold text-text-bright">
              {leftDesign?.name ?? "Left"}
            </span>
            <span className="text-text-dim text-xs">vs</span>
            <span className="text-sm font-semibold text-text-bright">
              {rightDesign?.name ?? "Right"}
            </span>
          </div>
          <button
            className="flex items-center gap-[5px] px-3.5 py-[5px] rounded-lg text-[13px] font-medium text-text-dim transition-all duration-150 hover:text-text-bright hover:bg-surface-3 bg-surface-2"
            onClick={() => setCompareIds(null)}
          >
            Exit Compare
          </button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 border-r border-border relative">
            <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-surface-2 border border-border rounded-md text-[11px] font-semibold text-text-dim">
              {leftDesign?.name}
            </div>
            <ReactFlowProvider>
              <ReactFlow
                nodes={leftState.nodes}
                edges={leftState.edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultViewport={leftState.viewport}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag
                zoomOnScroll
                fitView={false}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
          <div className="flex-1 relative">
            <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-surface-2 border border-border rounded-md text-[11px] font-semibold text-text-dim">
              {rightDesign?.name}
            </div>
            <ReactFlowProvider>
              <ReactFlow
                nodes={rightState.nodes}
                edges={rightState.edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultViewport={rightState.viewport}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag
                zoomOnScroll
                fitView={false}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <Canvas
        key={designId}
        designId={designId}
        designs={designs}
        onSwitchDesign={setDesignId}
        onCreateDesign={handleCreate}
        onRenameDesign={handleRename}
        onDeleteDesign={handleDelete}
        onForkDesign={handleFork}
        onStartCompare={handleStartCompare}
      />
    </ReactFlowProvider>
  );
}
