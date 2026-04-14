import { useCallback, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";

interface HistoryState<N extends Node> {
  nodes: N[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

export function useUndoRedo<N extends Node>(
  nodes: N[],
  edges: Edge[],
  setNodes: React.Dispatch<React.SetStateAction<N[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
) {
  const pastRef = useRef<HistoryState<N>[]>([]);
  const futureRef = useRef<HistoryState<N>[]>([]);
  const stateRef = useRef({ nodes, edges });
  stateRef.current = { nodes, edges };

  const takeSnapshot = useCallback(() => {
    const { nodes: n, edges: e } = stateRef.current;
    pastRef.current = [
      ...pastRef.current.slice(-(MAX_HISTORY - 1)),
      { nodes: structuredClone(n), edges: structuredClone(e) },
    ];
    futureRef.current = [];
  }, []);

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    pastRef.current = past.slice(0, -1);
    const { nodes: n, edges: e } = stateRef.current;
    futureRef.current = [
      ...futureRef.current,
      { nodes: structuredClone(n), edges: structuredClone(e) },
    ];
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (future.length === 0) return;
    const next = future[future.length - 1];
    futureRef.current = future.slice(0, -1);
    const { nodes: n, edges: e } = stateRef.current;
    pastRef.current = [
      ...pastRef.current,
      { nodes: structuredClone(n), edges: structuredClone(e) },
    ];
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [setNodes, setEdges]);

  return {
    takeSnapshot,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
