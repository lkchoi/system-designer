export interface ServerlessInputs {
  invocationsPerMonth: number;
  avgDurationMs: number;
  memoryMB: number;
  provider: "aws" | "gcp" | "cloudflare";
}

export interface ServerlessResult {
  computeCost: number;
  requestCost: number;
  totalCost: number;
  gbSeconds: number;
  freeComputeSavings: number;
  freeRequestSavings: number;
}

interface ProviderPricing {
  requestPricePer1M: number;
  gbSecondPrice: number;
  freeRequests: number;
  freeGbSeconds: number;
}

const PRICING: Record<string, ProviderPricing> = {
  aws: {
    requestPricePer1M: 0.2,
    gbSecondPrice: 0.0000166667,
    freeRequests: 1_000_000,
    freeGbSeconds: 400_000,
  },
  gcp: {
    requestPricePer1M: 0.4,
    gbSecondPrice: 0.0000025,
    freeRequests: 2_000_000,
    freeGbSeconds: 400_000,
  },
  cloudflare: {
    requestPricePer1M: 0.3,
    gbSecondPrice: 0.0000125,
    freeRequests: 10_000_000,
    freeGbSeconds: 400_000,
  },
};

export const PROVIDERS = [
  { id: "aws" as const, label: "AWS Lambda" },
  { id: "gcp" as const, label: "Cloud Functions" },
  { id: "cloudflare" as const, label: "Workers" },
];

export function computeServerlessCost(inputs: ServerlessInputs): ServerlessResult {
  const { invocationsPerMonth, avgDurationMs, memoryMB, provider } = inputs;
  const pricing = PRICING[provider];

  const durationSec = avgDurationMs / 1000;
  const gbSeconds = invocationsPerMonth * durationSec * (memoryMB / 1024);

  const billableGbSeconds = Math.max(0, gbSeconds - pricing.freeGbSeconds);
  const billableRequests = Math.max(0, invocationsPerMonth - pricing.freeRequests);

  const computeCost = billableGbSeconds * pricing.gbSecondPrice;
  const requestCost = (billableRequests / 1_000_000) * pricing.requestPricePer1M;

  const freeComputeSavings =
    Math.min(gbSeconds, pricing.freeGbSeconds) * pricing.gbSecondPrice;
  const freeRequestSavings =
    (Math.min(invocationsPerMonth, pricing.freeRequests) / 1_000_000) *
    pricing.requestPricePer1M;

  return {
    computeCost,
    requestCost,
    totalCost: computeCost + requestCost,
    gbSeconds,
    freeComputeSavings,
    freeRequestSavings,
  };
}

export function formatCost(dollars: number): string {
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  if (dollars < 1) return `$${dollars.toFixed(2)}`;
  if (dollars < 1000) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
