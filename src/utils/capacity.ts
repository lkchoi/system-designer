export type SizeUnit = 'B' | 'KB' | 'MB';

export interface CapacityInputs {
  tps: number;
  payloadSize: number;
  payloadUnit: SizeUnit;
  replicationFactor: number;
  readWriteRatio: number;
  retentionDays: number;
}

export interface CapacityResults {
  bytesPerSec: number;
  dailyGB: number;
  monthlyGB: number;
  yearlyTB: number;
  dailyReplicatedGB: number;
  monthlyReplicatedGB: number;
  yearlyReplicatedTB: number;
  bandwidthMbps: number;
  bandwidthReplicatedMbps: number;
  storage1y: number;
  storage3y: number;
  storage5y: number;
  retentionStorageTB: number;
  writesPerSec: number;
  readsPerSec: number;
  wcus: number;
  rcus: number;
}

function toBytes(value: number, unit: SizeUnit): number {
  switch (unit) {
    case 'B':  return value;
    case 'KB': return value * 1024;
    case 'MB': return value * 1024 * 1024;
  }
}

export function computeCapacity(inputs: CapacityInputs): CapacityResults {
  const payloadBytes = toBytes(inputs.payloadSize, inputs.payloadUnit);
  const bytesPerSec = inputs.tps * payloadBytes;
  const rf = Math.max(1, inputs.replicationFactor);

  const dailyGB = (bytesPerSec * 86_400) / 1024 ** 3;
  const monthlyGB = dailyGB * 30;
  const yearlyTB = (dailyGB * 365) / 1024;

  const dailyReplicatedGB = dailyGB * rf;
  const monthlyReplicatedGB = monthlyGB * rf;
  const yearlyReplicatedTB = yearlyTB * rf;

  const bandwidthMbps = (bytesPerSec * 8) / 1e6;
  const bandwidthReplicatedMbps = bandwidthMbps * rf;

  const dailyReplicatedTB = dailyReplicatedGB / 1024;
  const storage1y = dailyReplicatedTB * 365;
  const storage3y = dailyReplicatedTB * 365 * 3;
  const storage5y = dailyReplicatedTB * 365 * 5;
  const retentionStorageTB = dailyReplicatedTB * inputs.retentionDays;

  const ratio = Math.max(0, inputs.readWriteRatio);
  const writesPerSec = inputs.tps / (ratio + 1);
  const readsPerSec = inputs.tps - writesPerSec;

  const wCUMultiplier = Math.max(1, Math.ceil(payloadBytes / 1024));
  const rCUMultiplier = Math.max(1, Math.ceil(payloadBytes / 4096));
  const wcus = Math.ceil(writesPerSec * wCUMultiplier);
  const rcus = Math.ceil(readsPerSec * rCUMultiplier);

  return {
    bytesPerSec, dailyGB, monthlyGB, yearlyTB,
    dailyReplicatedGB, monthlyReplicatedGB, yearlyReplicatedTB,
    bandwidthMbps, bandwidthReplicatedMbps,
    storage1y, storage3y, storage5y, retentionStorageTB,
    writesPerSec, readsPerSec, wcus, rcus,
  };
}

export function formatDataSize(gb: number): string {
  if (gb < 0.001) return `${(gb * 1024 * 1024).toFixed(0)} KB`;
  if (gb < 1) return `${(gb * 1024).toFixed(1)} MB`;
  if (gb < 1024) return `${gb.toFixed(1)} GB`;
  const tb = gb / 1024;
  if (tb < 1024) return `${tb.toFixed(2)} TB`;
  return `${(tb / 1024).toFixed(2)} PB`;
}

export function formatTB(tb: number): string {
  if (tb < 0.001) return `${(tb * 1024 * 1024).toFixed(0)} KB`;
  if (tb < 1) return `${(tb * 1024).toFixed(1)} GB`;
  if (tb < 1024) return `${tb.toFixed(2)} TB`;
  return `${(tb / 1024).toFixed(2)} PB`;
}

export function formatBandwidth(mbps: number): string {
  if (mbps < 1) return `${(mbps * 1000).toFixed(0)} Kbps`;
  if (mbps < 1000) return `${mbps.toFixed(1)} Mbps`;
  return `${(mbps / 1000).toFixed(2)} Gbps`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1_000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toFixed(n < 10 && n % 1 !== 0 ? 1 : 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
}
