import initSqlJs from "sql.js";
import type { Database as SqlJsDatabase } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { SCHEMA } from "./schema";

const DB_FILE = "system-designer.db";

let db: SqlJsDatabase | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

async function readFromOpfs(): Promise<Uint8Array | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(DB_FILE);
    const file = await handle.getFile();
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

async function writeToOpfs(data: Uint8Array): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(DB_FILE, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function initDB(): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const existing = await readFromOpfs();

  db = existing ? new SQL.Database(existing) : new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run(SCHEMA);

  await persist();
  return db;
}

export function getDB(): SqlJsDatabase {
  if (!db) throw new Error("Database not initialized. Call initDB() first.");
  return db;
}

export async function persist(): Promise<void> {
  if (!db) return;
  const data = db.export();
  await writeToOpfs(new Uint8Array(data));
}

export function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persist();
    persistTimer = null;
  }, 300);
}

export function flushPersist(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
    persist();
  }
}
