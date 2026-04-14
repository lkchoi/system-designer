import type { Fetcher, FetchResult, TechnologyPricing } from "../types.ts";
import { log, toResult } from "../utils.ts";

// Cloudflare does not have a public pricing API.
// Prices sourced from https://www.cloudflare.com/plans/ and service-specific pages.

const STATIC: Record<string, TechnologyPricing> = {
  "Cloudflare API Gateway": {
    model: "Bundled into Cloudflare plan tiers. No separate per-request API Gateway charge.",
    unit: "Plan subscription. Advanced API Shield features require Enterprise.",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        description: "Endpoint management + schema validation; 100 endpoints",
      },
      { name: "Pro", price: "$20/month", description: "250 endpoints + 20 WAF rules" },
      { name: "Business", price: "$200/month", description: "500 endpoints + advanced WAF" },
      {
        name: "Enterprise + API Shield",
        price: "Custom",
        description: "10,000 endpoints, mTLS, JWT, rate limiting",
      },
    ],
  },

  "Cloudflare CDN": {
    model:
      "Flat subscription per zone. HTTP/HTTPS bandwidth is unlimited and unmetered on all plans — major differentiator.",
    unit: "Monthly plan subscription. No per-GB bandwidth charges for CDN.",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        description: "Unlimited CDN bandwidth, DDoS, SSL, basic WAF",
      },
      {
        name: "Pro",
        price: "$20/month",
        description: "Image optimization, enhanced WAF, mobile optimization",
      },
      {
        name: "Business",
        price: "$200/month",
        description: "100% SLA, PCI compliance, priority support",
      },
      {
        name: "Enterprise",
        price: "Custom (~$2,000+/mo)",
        description: "Dedicated support, Zero Trust, custom SLAs",
      },
      {
        name: "Argo Smart Routing",
        price: "~$5/mo + $0.10/GB",
        description: "Optional: faster routing via Cloudflare backbone",
      },
    ],
    freeTier:
      "Permanent free plan with unlimited HTTP bandwidth. Production-viable for personal sites.",
  },

  "Cloudflare R2": {
    model: "Per GB stored/month + per operation. Zero egress fees — always free data transfer out.",
    unit: "GB-month for storage. Class A (writes) per million. Class B (reads) per million. Egress: $0 always.",
    tiers: [
      { name: "Standard Storage", price: "$0.015/GB-month", description: "S3-compatible" },
      {
        name: "Infrequent Access",
        price: "$0.01/GB-month",
        description: "30-day min + $0.01/GB retrieval",
      },
      { name: "Class A Ops", price: "$4.50/million", description: "PUT, LIST, etc." },
      { name: "Class B Ops", price: "$0.36/million", description: "GET, HEAD, etc." },
      {
        name: "Egress",
        price: "$0 (always free)",
        description: "Major differentiator vs S3/GCS/Azure ($0.09/GB)",
      },
    ],
    freeTier: "10 GB storage + 1M Class A + 10M Class B ops/month — permanent",
  },

  "Cloudflare WAF": {
    model: "Included in Cloudflare plan subscriptions. No per-request charge for WAF.",
    unit: "Plan subscription — no per-request metering at any tier.",
    tiers: [
      { name: "Free", price: "$0/month", description: "Basic DDoS only, no custom WAF rules" },
      { name: "Pro", price: "$20/month", description: "Managed Ruleset + 20 custom rules" },
      { name: "Business", price: "$200/month", description: "Advanced WAF + 100% SLA" },
      {
        name: "Enterprise",
        price: "Custom",
        description: "Full suite + ML-based detection + custom rulesets",
      },
    ],
  },

  "Cloudflare DNS": {
    model: "Included in all plans including Free. No per-query charge at any tier.",
    unit: "Plan subscription only. Unlimited DNS queries at all tiers.",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        description: "Unlimited queries, Anycast, DNSSEC, DDoS protection",
      },
      { name: "Pro", price: "$20/month", description: "+ enhanced analytics" },
      {
        name: "Enterprise",
        price: "Custom",
        description: "Custom nameservers, China network, dedicated support",
      },
    ],
    freeTier: "Unlimited DNS queries permanently free on all plans",
  },

  "Cloudflare Workers": {
    model: "Request-based with CPU time limits. No egress charges — data transfer always free.",
    unit: "Requests/month + CPU milliseconds. Billing is on CPU time, not wall-clock time (I/O wait is free).",
    tiers: [
      { name: "Free Plan", price: "$0/month", description: "100K requests/day, 10ms CPU/request" },
      {
        name: "Paid Plan Base",
        price: "$5/month",
        description: "10M requests + 30M CPU-ms included",
      },
      { name: "Request Overage", price: "$0.30/million", description: "Above 10M/month" },
      { name: "CPU Overage", price: "$0.02/million CPU-ms", description: "Above 30M CPU-ms" },
    ],
    freeTier: "100K requests/day permanently free, no egress charges",
  },
};

export const fetcher: Fetcher = {
  name: "cloudflare",
  description: "Cloudflare services (static reference data)",
  technologies: Object.keys(STATIC),
  async fetch(): Promise<FetchResult[]> {
    log("Cloudflare: using static reference data (no public pricing API)");
    return Object.entries(STATIC).map(([tech, pricing]) =>
      toResult(tech, pricing, "https://www.cloudflare.com/plans/"),
    );
  },
};
