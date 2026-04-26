/**
 * CollabProvider — React context for collaborative editing.
 *
 * Manages the full lifecycle: share a design, join a room, disconnect.
 * When doc is null (local mode), all canvas behavior is unchanged.
 */

import { createContext, useContext, useState, useCallback, useRef } from "react";
import * as Y from "yjs";
import type { ReactNode } from "react";
import type { WebsocketProvider } from "y-websocket";
import { connectToRoom, type ConnectionStatus, type CollabConnection } from "./connection";
import { createRoom, clearRoomFromUrl } from "./roomApi";

export interface CollabContextValue {
  /** The Yjs document. Null when in local-only mode. */
  doc: Y.Doc | null;
  /** Nodes Y.Map from the doc. Null when local-only. */
  nodesMap: Y.Map<Y.Map<unknown>> | null;
  /** Edges Y.Map from the doc. Null when local-only. */
  edgesMap: Y.Map<Y.Map<unknown>> | null;
  /** The WebsocketProvider. Null when local-only. */
  provider: WebsocketProvider | null;
  /** Current connection status. */
  status: ConnectionStatus;
  /** Room ID if in a collaborative session. */
  roomId: string | null;
  /** Share the current design — creates a room and connects. */
  shareDesign: (designName: string) => Promise<string>;
  /** Join an existing room by ID. */
  joinRoom: (roomId: string) => void;
  /** Disconnect and return to local-only mode. */
  disconnect: () => void;
}

const CollabContext = createContext<CollabContextValue>({
  doc: null,
  nodesMap: null,
  edgesMap: null,
  provider: null,
  status: "disconnected",
  roomId: null,
  shareDesign: async () => "",
  joinRoom: () => {},
  disconnect: () => {},
});

export function useCollab(): CollabContextValue {
  return useContext(CollabContext);
}

export function CollabProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [nodesMap, setNodesMap] = useState<Y.Map<Y.Map<unknown>> | null>(null);
  const [edgesMap, setEdgesMap] = useState<Y.Map<Y.Map<unknown>> | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const connRef = useRef<CollabConnection | null>(null);

  const connect = useCallback((rid: string) => {
    // Clean up any existing connection
    connRef.current?.destroy();

    const conn = connectToRoom(rid, setStatus);
    connRef.current = conn;
    setDoc(conn.doc);
    setNodesMap(conn.nodesMap);
    setEdgesMap(conn.edgesMap);
    setProvider(conn.provider);
    setRoomId(rid);
  }, []);

  const shareDesign = useCallback(
    async (designName: string): Promise<string> => {
      const room = await createRoom(designName);
      connect(room.id);
      return room.id;
    },
    [connect],
  );

  const joinRoom = useCallback(
    (rid: string) => {
      connect(rid);
    },
    [connect],
  );

  const disconnect = useCallback(() => {
    connRef.current?.destroy();
    connRef.current = null;
    setDoc(null);
    setNodesMap(null);
    setEdgesMap(null);
    setProvider(null);
    setRoomId(null);
    setStatus("disconnected");
    clearRoomFromUrl();
  }, []);

  const value: CollabContextValue = {
    doc,
    nodesMap,
    edgesMap,
    provider,
    status,
    roomId,
    shareDesign,
    joinRoom,
    disconnect,
  };

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}
