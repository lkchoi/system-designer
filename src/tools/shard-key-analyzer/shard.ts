export interface ShardKeyCandidate {
  name: string;
  cardinality: "low" | "medium" | "high";
  distribution: "uniform" | "skewed" | "temporal";
  queryPattern: "point" | "range" | "scatter";
  growthPattern: "static" | "monotonic" | "random";
}

export interface ShardKeyScore {
  hotSpotRisk: number; // 0–100
  crossShardQueryRisk: number; // 0–100
  scalabilityScore: number; // 0–100
  overallScore: number; // 0–100
  warnings: string[];
  recommendation: string;
}

const CARDINALITY_SCORES: Record<string, number> = {
  low: 20,
  medium: 60,
  high: 90,
};

const DISTRIBUTION_HOTSPOT: Record<string, number> = {
  uniform: 10,
  skewed: 70,
  temporal: 80,
};

const QUERY_CROSS_SHARD: Record<string, number> = {
  point: 10,
  range: 60,
  scatter: 90,
};

const GROWTH_HOTSPOT: Record<string, number> = {
  static: 10,
  monotonic: 80,
  random: 15,
};

export function analyzeShardKey(candidate: ShardKeyCandidate): ShardKeyScore {
  const warnings: string[] = [];

  // Hot spot risk: distribution + growth + cardinality
  const distHotspot = DISTRIBUTION_HOTSPOT[candidate.distribution];
  const growthHotspot = GROWTH_HOTSPOT[candidate.growthPattern];
  const cardinalityPenalty = candidate.cardinality === "low" ? 30 : 0;
  const hotSpotRisk = Math.min(100, Math.round(
    distHotspot * 0.4 + growthHotspot * 0.4 + cardinalityPenalty * 0.2,
  ));

  // Cross-shard query risk
  const crossShardQueryRisk = QUERY_CROSS_SHARD[candidate.queryPattern];

  // Scalability score: cardinality * inverse of hotspot
  const cardScore = CARDINALITY_SCORES[candidate.cardinality];
  const scalabilityScore = Math.round(cardScore * 0.5 + (100 - hotSpotRisk) * 0.5);

  // Overall: weighted average
  const overallScore = Math.round(
    (100 - hotSpotRisk) * 0.35 +
    (100 - crossShardQueryRisk) * 0.35 +
    scalabilityScore * 0.3,
  );

  // Warnings
  if (candidate.cardinality === "low") {
    warnings.push("Low cardinality limits maximum shard count — data cannot be split finely");
  }
  if (candidate.distribution === "skewed") {
    warnings.push("Skewed distribution causes hot shards — a few keys will receive disproportionate traffic");
  }
  if (candidate.distribution === "temporal") {
    warnings.push("Temporal distribution routes recent writes to a single shard — consider adding a random suffix");
  }
  if (candidate.growthPattern === "monotonic") {
    warnings.push("Monotonically increasing keys (e.g. auto-increment, timestamp) cause write-hot-spot on the last shard");
  }
  if (candidate.queryPattern === "scatter") {
    warnings.push("Scatter queries touch all shards — consider denormalizing or adding a secondary index");
  }
  if (candidate.queryPattern === "range" && candidate.distribution === "uniform") {
    warnings.push("Range queries on a hash-distributed key require scanning all shards — consider range-based sharding instead");
  }

  // Recommendation
  let recommendation: string;
  if (overallScore >= 75) {
    recommendation = "Good shard key — well-suited for horizontal scaling";
  } else if (overallScore >= 50) {
    recommendation = "Acceptable with caveats — consider a compound key to improve weak areas";
  } else {
    recommendation = "Poor shard key — likely to cause hot spots or expensive cross-shard queries";
  }

  return {
    hotSpotRisk,
    crossShardQueryRisk,
    scalabilityScore,
    overallScore,
    warnings,
    recommendation,
  };
}

export interface CompoundKeyOption {
  name: string;
  description: string;
  example: string;
  mitigates: string;
}

export const COMPOUND_KEY_STRATEGIES: CompoundKeyOption[] = [
  {
    name: "Hash prefix",
    description: "Add a hash of another field as prefix to distribute writes",
    example: "hash(user_id) + timestamp",
    mitigates: "Monotonic growth hot spots",
  },
  {
    name: "Tenant + ID",
    description: "Combine tenant/org with entity ID for multi-tenant isolation",
    example: "tenant_id + order_id",
    mitigates: "Cross-tenant queries, data isolation",
  },
  {
    name: "Region + key",
    description: "Prefix with geographic region for locality",
    example: "region + user_id",
    mitigates: "Cross-region latency, data residency",
  },
  {
    name: "Bucket + timestamp",
    description: "Bucket timestamps into fixed intervals to spread writes",
    example: "date_bucket + event_id",
    mitigates: "Temporal hot spots",
  },
  {
    name: "Random suffix",
    description: "Append a random value to split hot keys across shards",
    example: "popular_key + random(0..N)",
    mitigates: "Celebrity/viral content hot keys",
  },
];

export const SHARD_KEY_EXAMPLES: { name: string; candidate: ShardKeyCandidate }[] = [
  {
    name: "user_id (UUID)",
    candidate: {
      name: "user_id",
      cardinality: "high",
      distribution: "uniform",
      queryPattern: "point",
      growthPattern: "random",
    },
  },
  {
    name: "created_at (timestamp)",
    candidate: {
      name: "created_at",
      cardinality: "high",
      distribution: "temporal",
      queryPattern: "range",
      growthPattern: "monotonic",
    },
  },
  {
    name: "country_code",
    candidate: {
      name: "country_code",
      cardinality: "low",
      distribution: "skewed",
      queryPattern: "point",
      growthPattern: "static",
    },
  },
  {
    name: "order_id (auto-increment)",
    candidate: {
      name: "order_id",
      cardinality: "high",
      distribution: "uniform",
      queryPattern: "point",
      growthPattern: "monotonic",
    },
  },
];
