/**
 * HTTP client for the collaboration server's room API.
 */

const SERVER_URL = import.meta.env.VITE_COLLAB_SERVER ?? "http://localhost:4444";

export interface RoomMeta {
  id: string;
  designName: string;
  createdAt: number;
  lastActiveAt: number;
  connections: number;
}

/** Create a new collaborative room. */
export async function createRoom(designName: string): Promise<RoomMeta> {
  const res = await fetch(`${SERVER_URL}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ designName }),
  });
  if (!res.ok) throw new Error(`Failed to create room: ${res.status}`);
  return res.json();
}

/** Get room metadata. Returns null if room doesn't exist. */
export async function getRoom(roomId: string): Promise<RoomMeta | null> {
  const res = await fetch(`${SERVER_URL}/rooms/${encodeURIComponent(roomId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get room: ${res.status}`);
  return res.json();
}

/** Get the WebSocket URL for a room. */
export function getWsUrl(roomId: string): string {
  const base = SERVER_URL.replace(/^http/, "ws");
  return `${base}/?room=${encodeURIComponent(roomId)}`;
}

/** Build a shareable URL for a room. */
export function getShareUrl(roomId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  return url.toString();
}

/** Extract room ID from the current URL's query params. */
export function getRoomIdFromUrl(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get("room");
}

/** Remove room param from the URL without reloading. */
export function clearRoomFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  window.history.replaceState({}, "", url.toString());
}

/** Check if the collab server is reachable. */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
