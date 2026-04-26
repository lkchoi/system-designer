/**
 * useCollabState — dual-mode state wrapper for nodes and edges.
 *
 * Local mode (doc is null): passes through to useState. Zero overhead.
 * Collab mode (doc is active): mutations diff against the Y.Doc and
 * apply changes via Y.Map transactions. Remote changes are observed
 * and merged into React state automatically.
 *
 * IMPORTANT: The returned setNodes/setEdges have stable identity —
 * they don't change when the doc transitions from null to active.
 * This prevents stale-closure bugs in onNodesChange/onEdgesChange.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { Edge, Node } from "@xyflow/react";
import { useCollab } from "./provider";
import {
  syncNodesToYMap,
  syncEdgesToYMap,
  materializeNodes,
  materializeEdges,
} from "./sync";
import { nodesToYMap, edgesToYMap } from "./schema";

/** Throttle interval for position-only updates during drag (ms). */
const DRAG_THROTTLE_MS = 50;

/**
 * Drop-in replacement for useState<Node[]> + useState<Edge[]>.
 * Returns [nodes, setNodes, edges, setEdges].
 *
 * In local mode (no Y.Doc), delegates to useState.
 * In collab mode, mutations flow through Yjs and remote changes
 * are observed and merged.
 */
export function useCollabState<N extends Node>(
  initialNodes: N[],
  initialEdges: Edge[],
): [
  N[],
  React.Dispatch<React.SetStateAction<N[]>>,
  Edge[],
  React.Dispatch<React.SetStateAction<Edge[]>>,
] {
  const { doc, nodesMap, edgesMap } = useCollab();
  const [nodes, setNodesRaw] = useState<N[]>(initialNodes);
  const [edges, setEdgesRaw] = useState<Edge[]>(initialEdges);

  // ─── Refs for stable closures ──────────────────────────────────────
  // These refs let the returned setNodes/setEdges have stable identity
  // while still reading the latest doc/nodesMap/edgesMap.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const docRef = useRef(doc);
  docRef.current = doc;
  const nodesMapRef = useRef(nodesMap);
  nodesMapRef.current = nodesMap;
  const edgesMapRef = useRef(edgesMap);
  edgesMapRef.current = edgesMap;

  // Track if we're in a local transaction to prevent echo
  const inLocalTxRef = useRef(false);

  // Throttle tracking for drag updates
  const lastNodeSyncRef = useRef(0);
  const pendingNodeSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Collab-mode: populate Y.Doc on first connect ──────────────────

  const initializedRef = useRef(false);
  useEffect(() => {
    if (!doc || !nodesMap || !edgesMap) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    // If the Y.Doc is empty (we're sharing), populate from local state.
    // If the Y.Doc has content (we're joining), materialize into React.
    if (nodesMap.size === 0 && edgesMap.size === 0) {
      nodesToYMap(nodesRef.current, nodesMap);
      edgesToYMap(edgesRef.current, edgesMap);
    } else {
      setNodesRaw(materializeNodes(nodesMap, nodesRef.current) as N[]);
      setEdgesRaw(materializeEdges(edgesMap, edgesRef.current));
    }
  }, [doc, nodesMap, edgesMap]);

  // ─── Collab-mode: observe remote changes ───────────────────────────

  useEffect(() => {
    if (!nodesMap) return;
    const handler = () => {
      if (inLocalTxRef.current) return;
      setNodesRaw(materializeNodes(nodesMap, nodesRef.current) as N[]);
    };
    nodesMap.observeDeep(handler);
    return () => nodesMap.unobserveDeep(handler);
  }, [nodesMap]);

  useEffect(() => {
    if (!edgesMap) return;
    const handler = () => {
      if (inLocalTxRef.current) return;
      setEdgesRaw(materializeEdges(edgesMap, edgesRef.current));
    };
    edgesMap.observeDeep(handler);
    return () => edgesMap.unobserveDeep(handler);
  }, [edgesMap]);

  // ─── Wrapped setNodes (STABLE IDENTITY via useCallback with no deps)

  const setNodes: React.Dispatch<React.SetStateAction<N[]>> = useCallback(
    (action) => {
      const currentDoc = docRef.current;
      const currentNodesMap = nodesMapRef.current;

      if (!currentDoc || !currentNodesMap) {
        // Local mode: pass through
        setNodesRaw(action);
        return;
      }

      // Collab mode: resolve the action, diff, and sync to Y.Doc
      const prev = nodesRef.current;
      const next = typeof action === "function" ? (action as (prev: N[]) => N[])(prev) : action;

      // Update React state immediately (optimistic)
      setNodesRaw(next);

      // Sync to Y.Doc with throttling for rapid position updates
      const now = Date.now();
      const isRapidUpdate = now - lastNodeSyncRef.current < DRAG_THROTTLE_MS;

      if (isRapidUpdate) {
        // Buffer the update — will flush when throttle expires
        if (pendingNodeSyncRef.current) clearTimeout(pendingNodeSyncRef.current);
        pendingNodeSyncRef.current = setTimeout(() => {
          pendingNodeSyncRef.current = null;
          lastNodeSyncRef.current = Date.now();
          inLocalTxRef.current = true;
          syncNodesToYMap(nodesRef.current, nodesRef.current, nodesMapRef.current!);
          inLocalTxRef.current = false;
        }, DRAG_THROTTLE_MS);
      } else {
        lastNodeSyncRef.current = now;
        inLocalTxRef.current = true;
        syncNodesToYMap(prev, next, currentNodesMap);
        inLocalTxRef.current = false;
      }
    },
    [], // stable identity — reads from refs
  );

  // ─── Wrapped setEdges (STABLE IDENTITY) ────────────────────────────

  const setEdges: React.Dispatch<React.SetStateAction<Edge[]>> = useCallback(
    (action) => {
      const currentDoc = docRef.current;
      const currentEdgesMap = edgesMapRef.current;

      if (!currentDoc || !currentEdgesMap) {
        setEdgesRaw(action);
        return;
      }

      const prev = edgesRef.current;
      const next = typeof action === "function" ? (action as (prev: Edge[]) => Edge[])(prev) : action;

      setEdgesRaw(next);

      inLocalTxRef.current = true;
      syncEdgesToYMap(prev, next, currentEdgesMap);
      inLocalTxRef.current = false;
    },
    [], // stable identity — reads from refs
  );

  // ─── Cleanup pending sync on unmount ───────────────────────────────

  useEffect(() => {
    return () => {
      if (pendingNodeSyncRef.current) {
        clearTimeout(pendingNodeSyncRef.current);
        if (nodesMapRef.current && docRef.current) {
          syncNodesToYMap(nodesRef.current, nodesRef.current, nodesMapRef.current);
        }
      }
    };
  }, []);

  return [nodes, setNodes, edges, setEdges];
}
