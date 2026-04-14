/**
 * Shared types for pricing fetch scripts.
 * Mirror src/types.ts pricing interfaces so scripts run independently.
 */

export interface PricingTier {
  name: string;
  price: string;
  description?: string;
}

export interface PricingMode {
  name: string;
  priceImpact: string;
  description: string;
}

export interface TechnologyPricing {
  model: string;
  unit: string;
  tiers: PricingTier[];
  freeTier?: string;
  modes?: PricingMode[];
}

export interface FetchResult {
  technology: string;
  pricing: TechnologyPricing;
  source: string;
  fetchedAt: string;
}

export interface Fetcher {
  name: string;
  description: string;
  technologies: string[];
  fetch(): Promise<FetchResult[]>;
}
