export interface DnsInputs {
  requestsPerSecond: number;
  changeFrequency: "rarely" | "daily" | "hourly" | "minutes";
  failoverRequired: boolean;
}

export interface DnsResult {
  recommendedTtl: number;
  propagationTime: string;
  cacheBenefit: number; // percent of requests served from cache
  tradeoff: string;
}

const CHANGE_FREQ_TTLS: Record<string, number> = {
  rarely: 86400, // 24h
  daily: 3600, // 1h
  hourly: 300, // 5min
  minutes: 60, // 1min
};

export function computeDnsTtl(inputs: DnsInputs): DnsResult {
  const { changeFrequency, failoverRequired } = inputs;

  let recommendedTtl = CHANGE_FREQ_TTLS[changeFrequency];
  if (failoverRequired && recommendedTtl > 60) {
    recommendedTtl = Math.min(recommendedTtl, 60);
  }

  const propagationTime = formatTtl(recommendedTtl);
  const cacheBenefit = recommendedTtl > 0 ? Math.min(99.9, (1 - 1 / recommendedTtl) * 100) : 0;

  let tradeoff: string;
  if (recommendedTtl <= 60) {
    tradeoff = "Low TTL: fast failover and updates, but higher DNS query volume and latency";
  } else if (recommendedTtl <= 300) {
    tradeoff = "Moderate TTL: balanced between responsiveness and caching efficiency";
  } else if (recommendedTtl <= 3600) {
    tradeoff = "Standard TTL: good caching, changes propagate within an hour";
  } else {
    tradeoff = "High TTL: excellent caching and performance, but slow to propagate changes";
  }

  return { recommendedTtl, propagationTime, cacheBenefit, tradeoff };
}

export function formatTtl(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export const COMMON_TTLS: { label: string; seconds: number; useCase: string }[] = [
  { label: "30s", seconds: 30, useCase: "Active failover / blue-green deploys" },
  { label: "60s", seconds: 60, useCase: "Fast failover with health checks" },
  { label: "5m", seconds: 300, useCase: "Frequently changing records" },
  { label: "1h", seconds: 3600, useCase: "Standard web services" },
  { label: "12h", seconds: 43200, useCase: "Stable services" },
  { label: "24h", seconds: 86400, useCase: "Rarely changing records (MX, TXT)" },
];
