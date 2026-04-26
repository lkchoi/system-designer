/**
 * WebSocket connection manager for Yjs collaboration.
 *
 * Wraps the y-websocket WebsocketProvider with connection lifecycle
 * management: connect, disconnect, status tracking.
 */

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { getWsUrl } from "./roomApi";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface CollabConnection {
  doc: Y.Doc;
  provider: WebsocketProvider;
  nodesMap: Y.Map<Y.Map<unknown>>;
  edgesMap: Y.Map<Y.Map<unknown>>;
  meta: Y.Map<unknown>;
  destroy: () => void;
}

/**
 * Create a Yjs document and WebSocket connection to a room.
 * The returned `destroy` function cleans up all resources.
 */
export function connectToRoom(
  roomId: string,
  onStatus: (status: ConnectionStatus) => void,
): CollabConnection {
  const doc = new Y.Doc();
  const nodesMap = doc.getMap("nodes") as Y.Map<Y.Map<unknown>>;
  const edgesMap = doc.getMap("edges") as Y.Map<Y.Map<unknown>>;
  const meta = doc.getMap("meta") as Y.Map<unknown>;

  const wsUrl = getWsUrl(roomId);
  // Extract server base for WebsocketProvider. It appends /ROOM_ID to form
  // the full URL: ws://host:port/ROOM_ID
  const urlObj = new URL(wsUrl);
  const serverBase = `${urlObj.protocol}//${urlObj.host}`;

  onStatus("connecting");

  // WebsocketProvider(serverUrl, roomname, doc) connects to serverUrl/roomname
  const provider = new WebsocketProvider(serverBase, roomId, doc, {
    connect: true,
    maxBackoffTime: 10000,
  });

  provider.on("status", ({ status }: { status: string }) => {
    if (status === "connected") onStatus("connected");
    else if (status === "connecting") onStatus("connecting");
    else onStatus("disconnected");
  });

  const destroy = () => {
    provider.disconnect();
    provider.destroy();
    doc.destroy();
    onStatus("disconnected");
  };

  return { doc, provider, nodesMap, edgesMap, meta, destroy };
}
