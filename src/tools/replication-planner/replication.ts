export interface ReplicationInputs {
  nodeCount: number;
  replicationFactor: number;
  consistencyLevel: "one" | "quorum" | "all";
}

export interface ReplicationResult {
  readQuorum: number;
  writeQuorum: number;
  toleratedReadFailures: number;
  toleratedWriteFailures: number;
  stronglyConsistent: boolean;
  readAvailability: number; // percent
  writeAvailability: number;
}

export function quorumSize(rf: number, level: "one" | "quorum" | "all"): number {
  if (level === "one") return 1;
  if (level === "all") return rf;
  return Math.floor(rf / 2) + 1;
}

export function computeReplication(inputs: ReplicationInputs): ReplicationResult {
  const { nodeCount, replicationFactor, consistencyLevel } = inputs;
  const rf = Math.min(replicationFactor, nodeCount);

  const readQuorum = quorumSize(rf, consistencyLevel);
  const writeQuorum = quorumSize(rf, consistencyLevel);

  const toleratedReadFailures = rf - readQuorum;
  const toleratedWriteFailures = rf - writeQuorum;

  // Strong consistency: R + W > RF
  const stronglyConsistent = readQuorum + writeQuorum > rf;

  // Simplified availability model: assume independent node failure probability of 0.1%
  const nodeFailRate = 0.001;
  const readAvailability = availabilityKofN(rf, readQuorum, 1 - nodeFailRate) * 100;
  const writeAvailability = availabilityKofN(rf, writeQuorum, 1 - nodeFailRate) * 100;

  return {
    readQuorum,
    writeQuorum,
    toleratedReadFailures,
    toleratedWriteFailures,
    stronglyConsistent,
    readAvailability,
    writeAvailability,
  };
}

/** Probability that at least k out of n nodes are up, given individual node availability p */
function availabilityKofN(n: number, k: number, p: number): number {
  let prob = 0;
  for (let i = k; i <= n; i++) {
    prob += binomialPmf(n, i, p);
  }
  return prob;
}

function binomialPmf(n: number, k: number, p: number): number {
  return binomialCoeff(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

function binomialCoeff(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

export const CONSISTENCY_LEVELS: { id: "one" | "quorum" | "all"; label: string; description: string }[] = [
  { id: "one", label: "ONE", description: "Any single replica responds" },
  { id: "quorum", label: "QUORUM", description: "Majority of replicas respond" },
  { id: "all", label: "ALL", description: "All replicas must respond" },
];
