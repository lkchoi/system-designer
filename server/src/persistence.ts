/**
 * Y.Doc persistence — file-based.
 *
 * Stores each room's Y.Doc as a binary file in PERSIST_DIR.
 * Pluggable: swap this module for S3, SQLite, or KV storage.
 */

import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

const PERSIST_DIR = process.env.PERSIST_DIR ?? "./data";

let dirReady = false;

async function ensureDir(): Promise<void> {
  if (dirReady) return;
  await mkdir(PERSIST_DIR, { recursive: true });
  dirReady = true;
}

function docPath(roomId: string): string {
  // Sanitize room ID to prevent path traversal
  const safe = roomId.replace(/[^a-zA-Z0-9_-]/g, "");
  return join(PERSIST_DIR, `${safe}.ydoc`);
}

/** Read a persisted Y.Doc update. Returns null if not found. */
export async function readDoc(roomId: string): Promise<Uint8Array | null> {
  await ensureDir();
  try {
    const buf = await readFile(docPath(roomId));
    return new Uint8Array(buf);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** Write a Y.Doc update to disk. */
export async function writeDoc(roomId: string, update: Uint8Array): Promise<void> {
  await ensureDir();
  await writeFile(docPath(roomId), update);
}

/** Delete a persisted Y.Doc. */
export async function deleteDoc(roomId: string): Promise<void> {
  try {
    await unlink(docPath(roomId));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
