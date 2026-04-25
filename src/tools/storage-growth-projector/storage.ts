export interface StorageInputs {
  dailyIngestGB: number;
  growthRatePercent: number; // monthly growth
  retentionDays: number;
  compressionRatio: number; // e.g. 2 means 2:1
  replicationFactor: number;
}

export interface StorageProjection {
  month: number;
  rawGB: number;
  compressedGB: number;
  replicatedGB: number;
}

export interface StorageResult {
  projections: StorageProjection[];
  retainedGB: number;
  compressedRetainedGB: number;
  replicatedRetainedGB: number;
  dailyIngestAfter1y: number;
  dailyIngestAfter3y: number;
}

export function projectStorage(inputs: StorageInputs): StorageResult {
  const { dailyIngestGB, growthRatePercent, retentionDays, compressionRatio, replicationFactor } =
    inputs;

  const monthlyGrowthFactor = 1 + growthRatePercent / 100;
  const projections: StorageProjection[] = [];

  for (let month = 0; month <= 60; month++) {
    const currentDailyIngest = dailyIngestGB * Math.pow(monthlyGrowthFactor, month);
    const daysInMonth = 30;
    const monthlyIngest = currentDailyIngest * daysInMonth;

    // Rolling window: retain only retentionDays worth of current ingest rate
    const retainedDays = Math.min(retentionDays, (month + 1) * 30);
    const rawGB = currentDailyIngest * retainedDays;

    // If retention is infinite (0 = no deletion), accumulate
    const cumulativeRawGB =
      retentionDays === 0
        ? projections.reduce((sum, p) => sum + p.rawGB / (retentionDays || (month * 30 || 30)), 0) *
            30 +
          monthlyIngest
        : rawGB;

    const effectiveRaw = retentionDays === 0 ? cumulativeRawGB : rawGB;
    const compressedGB = compressionRatio > 0 ? effectiveRaw / compressionRatio : effectiveRaw;
    const replicatedGB = compressedGB * replicationFactor;

    projections.push({ month, rawGB: effectiveRaw, compressedGB, replicatedGB });
  }

  const retainedGB = dailyIngestGB * retentionDays;
  const compressedRetainedGB = compressionRatio > 0 ? retainedGB / compressionRatio : retainedGB;
  const replicatedRetainedGB = compressedRetainedGB * replicationFactor;

  return {
    projections,
    retainedGB,
    compressedRetainedGB,
    replicatedRetainedGB,
    dailyIngestAfter1y: dailyIngestGB * Math.pow(monthlyGrowthFactor, 12),
    dailyIngestAfter3y: dailyIngestGB * Math.pow(monthlyGrowthFactor, 36),
  };
}

export function formatGB(gb: number): string {
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
  if (gb < 1024) return `${gb.toFixed(1)} GB`;
  const tb = gb / 1024;
  if (tb < 1024) return `${tb.toFixed(2)} TB`;
  return `${(tb / 1024).toFixed(2)} PB`;
}
