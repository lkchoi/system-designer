import * as Y from "yjs";
import { nanoid } from "nanoid";
import { readDoc, writeDoc, deleteDoc } from "./persistence.js";

export interface RoomMeta {
  id: string;
  designName: string;
  createdAt: number;
  lastActiveAt: number;
  /** Number of currently connected WebSocket clients. */
  connections: number;
}

interface RoomState {
  meta: RoomMeta;
  doc: Y.Doc;
}

const ROOM_TTL_MS =
  parseInt(process.env.ROOM_TTL_HOURS ?? "24", 10) * 60 * 60 * 1000;

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /** Create a new room. Returns the room metadata. */
  create(designName: string): RoomMeta {
    const id = nanoid(12);
    const now = Date.now();
    const doc = new Y.Doc();
    const meta: RoomMeta = {
      id,
      designName,
      createdAt: now,
      lastActiveAt: now,
      connections: 0,
    };
    this.rooms.set(id, { meta, doc });
    return meta;
  }

  /** Check if a room exists. */
  exists(id: string): boolean {
    return this.rooms.has(id);
  }

  /** Get room metadata. */
  getMeta(id: string): RoomMeta | undefined {
    return this.rooms.get(id)?.meta;
  }

  /**
   * Get or create the Y.Doc for a room. Loads from persistence if not
   * already in memory. Returns null if the room doesn't exist.
   */
  async getDoc(id: string): Promise<Y.Doc | null> {
    const room = this.rooms.get(id);
    if (!room) return null;

    // If doc is empty, try loading from persistence
    if (room.doc.store.clients.size === 0) {
      const persisted = await readDoc(id);
      if (persisted) {
        Y.applyUpdate(room.doc, persisted);
      }
    }

    return room.doc;
  }

  /** Mark a room as active (called on each WebSocket connection). */
  connect(id: string): void {
    const room = this.rooms.get(id);
    if (!room) return;
    room.meta.lastActiveAt = Date.now();
    room.meta.connections++;
  }

  /** Decrement connection count. Persist doc when last client leaves. */
  async disconnect(id: string): Promise<void> {
    const room = this.rooms.get(id);
    if (!room) return;
    room.meta.connections = Math.max(0, room.meta.connections - 1);
    room.meta.lastActiveAt = Date.now();

    // Persist when all clients have disconnected
    if (room.meta.connections === 0) {
      await this.persistRoom(id);
    }
  }

  /** Persist a room's Y.Doc to disk. */
  async persistRoom(id: string): Promise<void> {
    const room = this.rooms.get(id);
    if (!room) return;
    const update = Y.encodeStateAsUpdate(room.doc);
    await writeDoc(id, update);
  }

  /** Remove stale rooms (no connections for > ROOM_TTL). */
  private async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [id, room] of this.rooms) {
      if (room.meta.connections === 0 && now - room.meta.lastActiveAt > ROOM_TTL_MS) {
        room.doc.destroy();
        this.rooms.delete(id);
        await deleteDoc(id);
        console.log(`[rooms] cleaned up room ${id} (inactive ${Math.round((now - room.meta.lastActiveAt) / 3600000)}h)`);
      }
    }
  }

  /** Persist all rooms and stop cleanup timer. For graceful shutdown. */
  async shutdown(): Promise<void> {
    clearInterval(this.cleanupTimer);
    for (const [id] of this.rooms) {
      await this.persistRoom(id);
    }
  }

  /** Number of active rooms. */
  get size(): number {
    return this.rooms.size;
  }
}
