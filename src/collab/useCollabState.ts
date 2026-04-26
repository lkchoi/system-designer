/**
 * useCollabState — dual-mode state wrapper for nodes and edges.
 *
 * Local mode (doc is null): passes through to useState. Zero overhead.
 * Collab mode (doc is active): mutations use incremental diff (reference
 * identity) to sync only changed nodes to Y.Doc. Remote changes use
 * event-based patching to update only affected nodes in React state.
 *
 * IMPORTANT: The returned setNodes/setEdges have stable identity —
 * they don't change when the doc transitions from null to active.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { Edge, Node } from "@xyflow/react";
import * as Y from "yjs";
import { useCollab } from "./provider";
import {
  diffNodes,
  diffEdges,
  syncChangedNodes,
  syncChangedEdges,
  patchNodesFromEvents,
  patchEdgesFromEvents,
} from "./sync";
import { materializeNodes, materializeEdges } from "./sync-bulk";
import { nodesToYMap, edgesToYMap } from "./schema";

/** Throttle interval for position-only updates during drag (ms). */
const DRAG_THROTTLE_MS = 50;

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

  const inLocalTxRef = useRef(false);

  // Throttle tracking for drag updates
  const lastNodeSyncRef = useRef(0);
  const pendingNodeSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrevRef = useRef<N[] | null>(null);
  const pendingNextRef = useRef<N[] | null>(null);

  // ─── Collab-mode: populate Y.Doc on first connect ──────────────────

  const initializedRef = useRef(false);
  useEffect(() => {
    if (!doc || !nodesMap || !edgesMap) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (nodesMap.size === 0 && edgesMap.size === 0) {
      nodesToYMap(nodesRef.current, nodesMap);
      edgesToYMap(edgesRef.current, edgesMap);
    } else {
      setNodesRaw(materializeNodes(nodesMap, nodesRef.current) as N[]);
      setEdgesRaw(materializeEdges(edgesMap, edgesRef.current));
    }
  }, [doc, nodesMap, edgesMap]);

  // ─── Collab-mode: observe remote changes (incremental) ─────────────

  useEffect(() => {
    if (!nodesMap) return;
    const handler = (events: Y.YEvent<unknown>[]) => {
      if (inLocalTxRef.current) return;
      setNodesRaw((prev) => patchNodesFromEvents(events, nodesMap, prev) as N[]);
    };
    nodesMap.observeDeep(handler);
    return () => nodesMap.unobserveDeep(handler);
  }, [nodesMap]);

  useEffect(() => {
    if (!edgesMap) return;
    const handler = (events: Y.YEvent<unknown>[]) => {
      if (inLocalTxRef.current) return;
      setEdgesRaw((prev) => patchEdgesFromEvents(events, edgesMap, prev));
    };
    edgesMap.observeDeep(handler);
    return () => edgesMap.unobserveDeep(handler);
  }, [edgesMap]);

  // ─── Wrapped setNodes (STABLE IDENTITY, incremental diff) ──────────

  const setNodes: React.Dispatch<React.SetStateAction<N[]>> = useCallback((action) => {
    const currentDoc = docRef.current;
    const currentNodesMap = nodesMapRef.current;

    if (!currentDoc || !currentNodesMap) {
      setNodesRaw(action);
      return;
    }

    const prev = nodesRef.current;
    const next = typeof action === "function" ? (action as (prev: N[]) => N[])(prev) : action;

    // Update React state immediately (optimistic)
    setNodesRaw(next);

    // Incremental diff: only nodes with changed reference identity
    const now = Date.now();
    const isRapidUpdate = now - lastNodeSyncRef.current < DRAG_THROTTLE_MS;

    if (isRapidUpdate) {
      // Buffer: accumulate prev/next for the throttled flush
      if (!pendingPrevRef.current) pendingPrevRef.current = prev;
      pendingNextRef.current = next;

      if (pendingNodeSyncRef.current) clearTimeout(pendingNodeSyncRef.current);
      pendingNodeSyncRef.current = setTimeout(() => {
        pendingNodeSyncRef.current = null;
        lastNodeSyncRef.current = Date.now();
        const p = pendingPrevRef.current!;
        const n = pendingNextRef.current!;
        pendingPrevRef.current = null;
        pendingNextRef.current = null;

        const { changed, added, removedIds } = diffNodes(p, n);
        inLocalTxRef.current = true;
        syncChangedNodes(changed, added, removedIds, nodesMapRef.current!);
        inLocalTxRef.current = false;
      }, DRAG_THROTTLE_MS);
    } else {
      lastNodeSyncRef.current = now;
      const { changed, added, removedIds } = diffNodes(prev, next);
      inLocalTxRef.current = true;
      syncChangedNodes(changed, added, removedIds, currentNodesMap);
      inLocalTxRef.current = false;
    }
  }, []);

  // ─── Wrapped setEdges (STABLE IDENTITY, incremental diff) ──────────

  const setEdges: React.Dispatch<React.SetStateAction<Edge[]>> = useCallback((action) => {
    const currentDoc = docRef.current;
    const currentEdgesMap = edgesMapRef.current;

    if (!currentDoc || !currentEdgesMap) {
      setEdgesRaw(action);
      return;
    }

    const prev = edgesRef.current;
    const next = typeof action === "function" ? (action as (prev: Edge[]) => Edge[])(prev) : action;

    setEdgesRaw(next);

    const { changed, added, removedIds } = diffEdges(prev, next);
    inLocalTxRef.current = true;
    syncChangedEdges(changed, added, removedIds, currentEdgesMap);
    inLocalTxRef.current = false;
  }, []);

  // ─── Cleanup pending sync on unmount ───────────────────────────────

  useEffect(() => {
    return () => {
      if (pendingNodeSyncRef.current) {
        clearTimeout(pendingNodeSyncRef.current);
        if (
          nodesMapRef.current &&
          docRef.current &&
          pendingPrevRef.current &&
          pendingNextRef.current
        ) {
          const { changed, added, removedIds } = diffNodes(
            pendingPrevRef.current,
            pendingNextRef.current,
          );
          syncChangedNodes(changed, added, removedIds, nodesMapRef.current);
        }
      }
    };
  }, []);

  return [nodes, setNodes, edges, setEdges];
}
