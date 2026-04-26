/**
 * Collaborative editing server.
 *
 * HTTP endpoints:
 *   POST /rooms          — create a room
 *   GET  /rooms/:id      — room metadata
 *   GET  /health         — liveness check
 *
 * WebSocket:
 *   ws://host:PORT/?room=ROOM_ID — Yjs sync + awareness protocol
 */

import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { RoomManager } from "./rooms.js";

const PORT = parseInt(process.env.PORT ?? "4444", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

const rooms = new RoomManager();

// Track which clients are in which room (room → clients for O(1) broadcast)
const roomClients = new Map<string, Set<WebSocket>>();

// ─── HTTP Server ───────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // GET /health
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  // POST /rooms
  if (req.method === "POST" && url.pathname === "/rooms") {
    const body = await readBody(req);
    let designName = "Untitled";
    try {
      const parsed = JSON.parse(body);
      if (parsed.designName) designName = String(parsed.designName);
    } catch { /* use default */ }

    const meta = rooms.create(designName);
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify(meta));
    return;
  }

  // GET /rooms/:id
  if (req.method === "GET" && url.pathname.startsWith("/rooms/")) {
    const id = url.pathname.slice("/rooms/".length);
    const meta = rooms.getMeta(id);
    if (!meta) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "room not found" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(meta));
    return;
  }

  res.writeHead(404);
  res.end();
});

// ─── WebSocket Server ──────────────────────────────────────────────────

const wss = new WebSocketServer({ server });

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  // y-websocket puts the room name in the path: ws://host/ROOM_ID
  // Fall back to query param for flexibility.
  const roomId =
    url.pathname.slice(1).replace(/\/$/, "") || url.searchParams.get("room");

  if (!roomId || !rooms.exists(roomId)) {
    console.log(`[ws] rejected: room "${roomId}" not found (url: ${req.url})`);
    ws.close(4001, "Invalid room");
    return;
  }
  console.log(`[ws] client connected to room ${roomId}`);

  const doc = await rooms.getDoc(roomId);
  if (!doc) {
    ws.close(4002, "Room not found");
    return;
  }

  rooms.connect(roomId);
  if (!roomClients.has(roomId)) roomClients.set(roomId, new Set());
  roomClients.get(roomId)!.add(ws);

  // Send initial sync step 1 to the client
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);
    ws.send(encoding.toUint8Array(encoder));
  }

  // Handle incoming messages
  ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
    const buf = data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : Array.isArray(data)
        ? Buffer.concat(data)
        : new Uint8Array(data);

    const decoder = decoding.createDecoder(buf);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MSG_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, doc, null);
      if (encoding.length(encoder) > 1) {
        ws.send(encoding.toUint8Array(encoder));
      }
    } else if (messageType === MSG_AWARENESS) {
      // Pure relay: forward the raw awareness message to all other clients
      broadcast(roomId, buf, ws);
    }
  });

  // Broadcast doc updates to all other clients in the same room
  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);
    broadcast(roomId, msg, ws);
  };
  doc.on("update", onDocUpdate);

  // Cleanup on disconnect
  ws.on("close", () => {
    console.log(`[ws] client disconnected from room ${roomId}`);
    doc.off("update", onDocUpdate);
    roomClients.get(roomId)?.delete(ws);
    rooms.disconnect(roomId);
  });
});

/** Send a message to all WebSocket clients in a room, optionally excluding one. */
function broadcast(roomId: string, msg: Uint8Array, exclude?: WebSocket): void {
  const clients = roomClients.get(roomId);
  if (!clients) return;
  for (const client of clients) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

/** Read the full request body as a string. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

// ─── Graceful shutdown ─────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received, shutting down...`);
  await rooms.shutdown();
  wss.close();
  server.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ─── Start ─────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
  console.log(`[server] health: http://localhost:${PORT}/health`);
  console.log(`[server] ws:     ws://localhost:${PORT}/?room=ROOM_ID`);
});
