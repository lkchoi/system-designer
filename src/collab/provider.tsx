/**
 * CollabProvider — React context for collaborative editing.
 *
 * When doc is null (local mode), all canvas behavior is unchanged.
 * When doc is set (collab mode), mutations flow through Yjs.
 */

import { createContext, useContext, useState, useCallback, useRef } from "react";
import * as Y from "yjs";
import type { ReactNode } from "react";

export interface CollabContextValue {
  /** The Yjs document. Null when in local-only mode. */
  doc: Y.Doc | null;
  /** Nodes Y.Map from the doc. Null when local-only. */
  nodesMap: Y.Map<Y.Map<unknown>> | null;
  /** Edges Y.Map from the doc. Null when local-only. */
  edgesMap: Y.Map<Y.Map<unknown>> | null;
  /** Current connection status. */
  status: "disconnected" | "connecting" | "connected";
  /** Room ID if in a collaborative session. */
  roomId: string | null;
}

const CollabContext = createContext<CollabContextValue>({
  doc: null,
  nodesMap: null,
  edgesMap: null,
  status: "disconnected",
  roomId: null,
});

export function useCollab(): CollabContextValue {
  return useContext(CollabContext);
}

export function CollabProvider({ children }: { children: ReactNode }) {
  // Phase 1: always local-only. Later phases will add shareDesign/joinRoom.
  const value: CollabContextValue = {
    doc: null,
    nodesMap: null,
    edgesMap: null,
    status: "disconnected",
    roomId: null,
  };

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}
