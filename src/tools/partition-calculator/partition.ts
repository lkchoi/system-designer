export interface PartitionInputs {
  throughputMBps: number;
  messageSize: number; // bytes
  consumerCount: number;
  consumerThroughputMBps: number;
  retentionHours: number;
  replicationFactor: number;
}

export interface PartitionResult {
  messagesPerSec: number;
  minPartitionsByThroughput: number;
  minPartitionsByConsumers: number;
  recommendedPartitions: number;
  storagePerPartitionGB: number;
  totalStorageGB: number;
  replicatedStorageGB: number;
}

export function computePartitions(inputs: PartitionInputs): PartitionResult {
  const {
    throughputMBps,
    messageSize,
    consumerCount,
    consumerThroughputMBps,
    retentionHours,
    replicationFactor,
  } = inputs;

  const throughputBps = throughputMBps * 1024 * 1024;
  const messagesPerSec = messageSize > 0 ? throughputBps / messageSize : 0;

  // Partitions needed to handle producer throughput
  // Assuming ~1 MB/s per partition write throughput (Kafka default)
  const minPartitionsByThroughput = consumerThroughputMBps > 0
    ? Math.ceil(throughputMBps / consumerThroughputMBps)
    : 1;

  // At least one partition per consumer for max parallelism
  const minPartitionsByConsumers = Math.max(1, consumerCount);

  // Recommended = max of both, rounded up to nice number
  const rawRecommended = Math.max(minPartitionsByThroughput, minPartitionsByConsumers);
  const recommendedPartitions = roundUpToNice(rawRecommended);

  // Storage per partition
  const bytesPerHour = throughputBps * 3600;
  const totalBytesRetained = bytesPerHour * retentionHours;
  const storagePerPartitionGB =
    recommendedPartitions > 0
      ? totalBytesRetained / recommendedPartitions / (1024 * 1024 * 1024)
      : 0;
  const totalStorageGB = totalBytesRetained / (1024 * 1024 * 1024);
  const replicatedStorageGB = totalStorageGB * replicationFactor;

  return {
    messagesPerSec,
    minPartitionsByThroughput,
    minPartitionsByConsumers,
    recommendedPartitions,
    storagePerPartitionGB,
    totalStorageGB,
    replicatedStorageGB,
  };
}

function roundUpToNice(n: number): number {
  if (n <= 1) return 1;
  if (n <= 3) return n;
  if (n <= 6) return 6;
  if (n <= 12) return 12;
  // Round up to next multiple of 6
  return Math.ceil(n / 6) * 6;
}

export function formatRate(n: number): string {
  if (n < 1000) return n.toFixed(0);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function formatStorage(gb: number): string {
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
  if (gb < 1024) return `${gb.toFixed(1)} GB`;
  return `${(gb / 1024).toFixed(2)} TB`;
}
