export interface CacheInputs {
  objectCount: number;
  avgObjectSizeBytes: number;
  ttlSeconds: number;
  hitRate: number; // 0-100
  writeRate: number; // objects/sec
  overheadPercent: number; // per-key overhead (pointers, metadata)
}

export interface CacheResult {
  rawMemoryMB: number;
  withOverheadMB: number;
  evictionsPerSec: number;
  missRate: number;
  readsFromOriginPerSec: number;
  effectiveWriteRate: number;
}

export function computeCache(inputs: CacheInputs): CacheResult {
  const {
    objectCount,
    avgObjectSizeBytes,
    ttlSeconds,
    hitRate,
    writeRate,
    overheadPercent,
  } = inputs;

  const rawBytes = objectCount * avgObjectSizeBytes;
  const rawMemoryMB = rawBytes / (1024 * 1024);
  const withOverheadMB = rawMemoryMB * (1 + overheadPercent / 100);

  // Evictions: objects expiring per second based on TTL
  const evictionsPerSec = ttlSeconds > 0 ? objectCount / ttlSeconds : 0;

  const missRate = 100 - hitRate;
  // Reads that miss cache go to origin
  const readsFromOriginPerSec = writeRate * (missRate / 100);
  // Effective writes include new writes + refills from misses
  const effectiveWriteRate = writeRate + readsFromOriginPerSec;

  return {
    rawMemoryMB,
    withOverheadMB,
    evictionsPerSec,
    missRate,
    readsFromOriginPerSec,
    effectiveWriteRate,
  };
}

export function formatMemory(mb: number): string {
  if (mb < 1) return `${(mb * 1024).toFixed(0)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  if (gb < 1024) return `${gb.toFixed(2)} GB`;
  return `${(gb / 1024).toFixed(2)} TB`;
}

export const COMMON_OBJECT_SIZES: { label: string; bytes: number }[] = [
  { label: "Session token", bytes: 256 },
  { label: "User profile", bytes: 2048 },
  { label: "API response (small)", bytes: 4096 },
  { label: "API response (medium)", bytes: 16384 },
  { label: "Serialized object", bytes: 1024 },
  { label: "HTML fragment", bytes: 8192 },
];
