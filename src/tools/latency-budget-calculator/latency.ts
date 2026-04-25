export interface LatencyHop {
  name: string;
  p50Ms: number;
  p99Ms: number;
}

export interface LatencyResult {
  totalP50: number;
  totalP99: number;
  budgetMs: number;
  remainingP50: number;
  remainingP99: number;
  withinBudgetP50: boolean;
  withinBudgetP99: boolean;
}

export function computeLatencyBudget(hops: LatencyHop[], budgetMs: number): LatencyResult {
  const totalP50 = hops.reduce((sum, h) => sum + h.p50Ms, 0);
  const totalP99 = hops.reduce((sum, h) => sum + h.p99Ms, 0);
  return {
    totalP50,
    totalP99,
    budgetMs,
    remainingP50: budgetMs - totalP50,
    remainingP99: budgetMs - totalP99,
    withinBudgetP50: totalP50 <= budgetMs,
    withinBudgetP99: totalP99 <= budgetMs,
  };
}

export function percentOfBudget(ms: number, budgetMs: number): number {
  return budgetMs > 0 ? (ms / budgetMs) * 100 : 0;
}

export const COMMON_LATENCIES: { name: string; p50: number; p99: number }[] = [
  { name: "CDN edge", p50: 5, p99: 20 },
  { name: "Load balancer", p50: 1, p99: 5 },
  { name: "API gateway", p50: 3, p99: 15 },
  { name: "Service (compute)", p50: 10, p99: 50 },
  { name: "Database query", p50: 5, p99: 30 },
  { name: "Cache hit (Redis)", p50: 0.5, p99: 2 },
  { name: "Cache miss + DB", p50: 15, p99: 80 },
  { name: "Cross-region hop", p50: 50, p99: 100 },
  { name: "External API call", p50: 100, p99: 500 },
  { name: "DNS resolution", p50: 1, p99: 50 },
];
