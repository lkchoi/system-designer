import type { Fetcher, FetchResult, TechnologyPricing } from "../types.ts";
import { fetchJson, log, warn, toResult } from "../utils.ts";

// GCP public pricing is available at:
// https://cloudpricingcalculator.appspot.com/static/data/pricelist.json
// This returns a large JSON with SKU-based pricing.

const GCP_PRICING_URL =
  "https://cloudpricingcalculator.appspot.com/static/data/pricelist.json";

// ─── Types for GCP pricing JSON structure ───────────────────────────────────

interface GcpSkuPricing {
  [region: string]: number | string;
}

interface GcpPriceList {
  gcp_price_list: Record<string, GcpSkuPricing>;
  updated?: string;
}

// ─── Static pricing data (source of truth for descriptions) ─────────────────

const STATIC: Record<string, TechnologyPricing> = {
  "Google Cloud Firestore": {
    model:
      "Per-operation billing: charged for every document read, write, and delete individually. No provisioned capacity concept.",
    unit: "Document operations. Queries charge for each document returned (not per query). A query returning 1,000 documents = 1,000 read operations.",
    tiers: [
      { name: "Reads", price: "$0.06 per 100,000", description: "$0.60/million reads" },
      { name: "Writes", price: "$0.18 per 100,000", description: "$1.80/million writes" },
      { name: "Deletes", price: "$0.02 per 100,000", description: "$0.20/million deletes" },
      { name: "Storage", price: "$0.18/GB-month", description: "Document and index storage" },
      { name: "Network Egress", price: "$0.12/GB", description: "After 10 GB free/month" },
    ],
    freeTier:
      "Daily: 50K reads + 20K writes + 20K deletes + 1 GiB storage. Resets midnight Pacific.",
  },

  "Google Cloud Storage": {
    model:
      "Per GB stored/month by class + Class A/B operation charges + retrieval fees for cold classes + egress.",
    unit: "GB-month storage + per 10,000 operations (Class A: writes, Class B: reads) + per GB retrieval for cold classes.",
    tiers: [
      {
        name: "Standard (single region)",
        price: "$0.020/GB-month",
        description: "No retrieval fee, no min duration",
      },
      { name: "Nearline", price: "$0.010/GB-month", description: "30-day min, $0.01/GB retrieval" },
      { name: "Coldline", price: "$0.004/GB-month", description: "90-day min, $0.02/GB retrieval" },
      {
        name: "Archive",
        price: "$0.0022/GB-month",
        description: "365-day min, $0.05/GB retrieval",
      },
    ],
    freeTier:
      "5 GB Standard (US only) + 5K Class A + 50K Class B + 1 GB egress/month — always free",
  },

  "GCP Cloud Load Balancing": {
    model: "Per forwarding rule (hourly) + per GB data processed.",
    unit: "Forwarding rules and GiB processed.",
    tiers: [
      {
        name: "Forwarding Rule (first 5)",
        price: "$0.025/hr each",
        description: "~$18.25/month per rule",
      },
      {
        name: "Forwarding Rules (6+)",
        price: "~$0.01/hr each",
        description: "~$7.30/month per rule (reduced)",
      },
      {
        name: "Data Processing",
        price: "$0.008/GiB",
        description: "Both inbound and outbound for L7 LB",
      },
    ],
  },

  "GCP Cloud CDN": {
    model: "Per GB cache egress + per GB cache fill + per request. Requires a Cloud Load Balancer.",
    unit: "Per GiB served to users (cache egress) + per GiB fetched from origin (cache fill) + per 10,000 requests.",
    tiers: [
      {
        name: "Cache Egress (US/EU, <10 TiB)",
        price: "$0.08/GiB",
        description: "Data served from CDN to users",
      },
      {
        name: "Cache Fill (same region)",
        price: "$0.01/GiB",
        description: "Fetched from origin to CDN",
      },
      { name: "Request Charge", price: "$0.0075 per 10,000", description: "Cache lookup requests" },
    ],
  },

  "GCP Cloud DNS": {
    model: "Per managed zone/month + per million queries.",
    unit: "Zones/month + queries/million.",
    tiers: [
      {
        name: "Zone (first 25)",
        price: "$0.20/zone/month",
        description: "60% cheaper than Route 53",
      },
      { name: "Queries", price: "$0.40/million", description: "First 1B/month" },
    ],
  },

  "GCP Cloud Armor": {
    model:
      "Standard: pay-per-use (per policy + rule + request). Managed Protection Plus: $3,000/month annual subscription.",
    unit: "Per policy/month + per rule/month + per million requests (Standard). Or flat monthly subscription (Plus).",
    tiers: [
      { name: "Standard Policy", price: "$5.00/policy/month", description: "Pay-as-you-go" },
      { name: "Standard Rule", price: "$1.00/rule/month", description: "Per WAF rule" },
      { name: "Standard Requests", price: "$0.75/million", description: "Processed requests" },
      {
        name: "Managed Protection Plus",
        price: "$3,000/month",
        description:
          "Annual commit; includes all policies/rules/requests + DDoS response + ML protection",
      },
    ],
  },

  "Google Pub/Sub": {
    model:
      "Data-volume based (not message count). Billed on total bytes published and delivered. 1 KB minimum per API call.",
    unit: "Per TiB of message throughput. Both published and delivered bytes count.",
    tiers: [
      {
        name: "Message Delivery",
        price: "$40/TiB",
        description: "After free tier; applies to pub + sub bytes",
      },
      {
        name: "Retention Storage",
        price: "$0.10–$0.21/GiB-month",
        description: "For topics with message retention configured",
      },
    ],
    freeTier: "10 GiB/month of message delivery per billing account",
    modes: [
      {
        name: "Exactly-Once Delivery",
        priceImpact: "No pricing premium",
        description: "Enable via acknowledgement IDs; minor latency overhead",
      },
      {
        name: "BigQuery Subscriptions",
        priceImpact: "BQ storage/query rates",
        description: "Direct write from Pub/Sub to BigQuery",
      },
    ],
  },

  "Google Cloud Functions": {
    model: "Three dimensions: invocations + compute time (CPU + memory separately) + egress.",
    unit: "Invocations + GB-seconds (memory) + GHz-seconds (CPU), billed per 100ms.",
    tiers: [
      { name: "Invocations", price: "$0.40/million", description: "After first 2M free" },
      { name: "Memory (GB-second, Tier 1)", price: "$0.0000025", description: "Standard regions" },
      { name: "CPU (GHz-second, Tier 1)", price: "$0.0000100", description: "Standard regions" },
      { name: "Network Egress", price: "$0.12/GB", description: "First 5 GB/month free" },
    ],
    freeTier: "2M invocations + 400K GB-sec + 200K GHz-sec + 5 GB egress/month — permanently free",
  },

  "Google Cloud Run": {
    model: "Per vCPU-second + per GiB-second + per request. Scales to zero (no charge when idle).",
    unit: "vCPU-second + GiB-second + requests/million.",
    tiers: [
      { name: "CPU (Tier 1)", price: "$0.000024/vCPU-sec", description: "Standard regions" },
      { name: "Memory (Tier 1)", price: "$0.0000025/GiB-sec", description: "Standard regions" },
      { name: "Requests", price: "$0.40/million", description: "After 2M free" },
    ],
    freeTier: "180K vCPU-sec + 360K GiB-sec + 2M requests/month — permanently free",
    modes: [
      {
        name: "CPU always allocated",
        priceImpact: "Billed continuously",
        description: "Required for background tasks; CPU not freed between requests",
      },
      {
        name: "Minimum instances",
        priceImpact: "10% of normal CPU rate when idle",
        description: "Warm instances that never scale to zero",
      },
      {
        name: "CUDs (1yr)",
        priceImpact: "Up to 17% off",
        description: "Committed Use Discounts on compute",
      },
    ],
  },

  "GKE Autopilot": {
    model:
      "Per-pod billing: vCPU + GiB per second. No node management. Google manages infrastructure.",
    unit: "Per-pod vCPU-hour + GiB-hour. Each pod has ~180m vCPU + 512 MiB system overhead.",
    tiers: [
      { name: "CPU", price: "$0.0445/vCPU-hr", description: "Per-pod billing" },
      { name: "Memory", price: "$0.0049/GiB-hr", description: "Per-pod billing" },
      { name: "Ephemeral Storage", price: "$0.00014/GiB-hr", description: "Per-pod" },
    ],
    modes: [
      { name: "Spot Pods", priceImpact: "60–91% discount", description: "Interruptible workloads" },
      {
        name: "Autopilot vs Standard tradeoff",
        priceImpact: "Higher per-resource rate",
        description:
          "Pay only for pod requests (no wasted node capacity) vs cheaper per-resource on Standard",
      },
    ],
  },

  "Google BigQuery": {
    model:
      "On-Demand: per TiB scanned by queries. Capacity: per slot-hour reserved. Storage billed separately.",
    unit: "Slot — roughly 1 virtual CPU of query processing power. On-demand borrows slots from shared pool at $6.25/TiB scanned. Capacity reserves dedicated slots at $0.04–$0.10/slot-hour by edition.",
    tiers: [
      {
        name: "On-Demand Queries",
        price: "$6.25/TiB scanned",
        description: "First 1 TiB/month free",
      },
      { name: "Standard Slots", price: "$0.04/slot-hr", description: "PAYG, basic autoscaling" },
      {
        name: "Enterprise Slots",
        price: "$0.06/slot-hr",
        description: "PAYG; 1yr commit: $0.048; 3yr: $0.036",
      },
      {
        name: "Enterprise Plus Slots",
        price: "$0.10/slot-hr",
        description: "Highest SLA, cross-cloud analytics",
      },
      {
        name: "Active Storage",
        price: "$0.02/GB-month (logical)",
        description: "Modified in last 90 days",
      },
      {
        name: "Long-Term Storage",
        price: "$0.01/GB-month (logical)",
        description: "Unmodified 90+ days (auto-transitions)",
      },
    ],
    freeTier: "1 TiB queries + 10 GiB storage/month — permanently free",
  },

  "Google Dataflow": {
    model:
      "Per resource-hour: vCPUs, memory, disk, plus data processed through shuffle/streaming engine. Billed per second.",
    unit: "vCPU-hour + GB-hour (memory) + GB-hour (disk) + GB (data processed).",
    tiers: [
      { name: "Batch vCPU", price: "$0.059/vCPU-hr", description: "Standard batch processing" },
      { name: "Streaming vCPU", price: "$0.072/vCPU-hr", description: "~22% premium over batch" },
      { name: "Memory", price: "$0.004172/GB-hr", description: "Same for batch and streaming" },
      {
        name: "Streaming Engine Data",
        price: "$0.018/GB",
        description: "Data processed through streaming engine",
      },
      {
        name: "FlexRS Batch vCPU",
        price: "$0.0354/hr",
        description: "40% cheaper, flexible scheduling",
      },
    ],
  },

  "GCP Cloud Scheduler": {
    model: "Per job definition (not per execution). A job's existence is billed, not its runs.",
    unit: "Jobs/month. Paused jobs still count.",
    tiers: [{ name: "Per Job", price: "$0.10/job/month", description: "Pro-rated daily" }],
    freeTier: "3 free jobs/month per billing account",
  },
};

// ─── SKU prefix → technology mapping ────────────────────────────────────────

interface SkuMapping {
  technology: string;
  prefix: string;
  /** Extract a price from matching SKU entries (us-east1 or us region). */
  extract: (entries: Record<string, GcpSkuPricing>) => Partial<Record<string, number>> | undefined;
}

/** Helper: pull a numeric price from a SKU entry, preferring us-east1 then us. */
function regionPrice(sku: GcpSkuPricing | undefined): number | undefined {
  if (!sku) return undefined;
  for (const region of ["us-east1", "us", "us-central1"]) {
    const val = sku[region];
    if (typeof val === "number") return val;
  }
  return undefined;
}

/** Collect all entries whose key starts with `prefix`. */
function matchSkus(
  priceList: Record<string, GcpSkuPricing>,
  prefix: string,
): Record<string, GcpSkuPricing> {
  const matched: Record<string, GcpSkuPricing> = {};
  for (const [key, value] of Object.entries(priceList)) {
    if (key.startsWith(prefix)) {
      matched[key] = value;
    }
  }
  return matched;
}

const SKU_MAPPINGS: SkuMapping[] = [
  {
    technology: "Google Cloud Firestore",
    prefix: "CP-FIRESTORE-",
    extract(entries) {
      const reads = regionPrice(entries["CP-FIRESTORE-READS"]);
      const writes = regionPrice(entries["CP-FIRESTORE-WRITES"]);
      const deletes = regionPrice(entries["CP-FIRESTORE-DELETES"]);
      const storage = regionPrice(entries["CP-FIRESTORE-STORAGE"]);
      if (!reads && !writes) return undefined;
      return { reads, writes, deletes, storage };
    },
  },
  {
    technology: "Google Cloud Storage",
    prefix: "CP-BIGSTORE-",
    extract(entries) {
      const standard = regionPrice(entries["CP-BIGSTORE-STORAGE"]);
      const nearline = regionPrice(entries["CP-BIGSTORE-NEARLINE-STORAGE"]);
      const coldline = regionPrice(entries["CP-BIGSTORE-COLDLINE-STORAGE"]);
      const archive = regionPrice(entries["CP-BIGSTORE-ARCHIVE-STORAGE"]);
      if (!standard) return undefined;
      return { standard, nearline, coldline, archive };
    },
  },
  {
    technology: "GCP Cloud CDN",
    prefix: "CP-CDN-",
    extract(entries) {
      const cacheEgress = regionPrice(entries["CP-CDN-CACHE-EGRESS"]);
      const cacheFill = regionPrice(entries["CP-CDN-CACHE-FILL"]);
      if (!cacheEgress) return undefined;
      return { cacheEgress, cacheFill };
    },
  },
  {
    technology: "GCP Cloud DNS",
    prefix: "CP-CLOUD-DNS-",
    extract(entries) {
      const zone = regionPrice(entries["CP-CLOUD-DNS-MANAGED-ZONE"]);
      const queries = regionPrice(entries["CP-CLOUD-DNS-QUERIES"]);
      if (!zone && !queries) return undefined;
      return { zone, queries };
    },
  },
  {
    technology: "GCP Cloud Armor",
    prefix: "CP-CLOUD-ARMOR-",
    extract(entries) {
      const policy = regionPrice(entries["CP-CLOUD-ARMOR-POLICY"]);
      const rule = regionPrice(entries["CP-CLOUD-ARMOR-RULE"]);
      const requests = regionPrice(entries["CP-CLOUD-ARMOR-REQUESTS"]);
      if (!policy && !rule) return undefined;
      return { policy, rule, requests };
    },
  },
  {
    technology: "Google Pub/Sub",
    prefix: "CP-PUBSUB-",
    extract(entries) {
      const messageDelivery = regionPrice(entries["CP-PUBSUB-MESSAGE-DELIVERY"]);
      if (!messageDelivery) return undefined;
      return { messageDelivery };
    },
  },
  {
    technology: "Google Cloud Functions",
    prefix: "CP-FUNCTIONS-",
    extract(entries) {
      const invocations = regionPrice(entries["CP-FUNCTIONS-INVOCATIONS"]);
      const memory = regionPrice(entries["CP-FUNCTIONS-MEMORY"]);
      const cpu = regionPrice(entries["CP-FUNCTIONS-CPU"]);
      if (!invocations && !memory) return undefined;
      return { invocations, memory, cpu };
    },
  },
  {
    technology: "Google Cloud Run",
    prefix: "CP-CLOUD-RUN-",
    extract(entries) {
      const cpu = regionPrice(entries["CP-CLOUD-RUN-CPU"]);
      const memory = regionPrice(entries["CP-CLOUD-RUN-MEMORY"]);
      const requests = regionPrice(entries["CP-CLOUD-RUN-REQUESTS"]);
      if (!cpu && !memory) return undefined;
      return { cpu, memory, requests };
    },
  },
  {
    technology: "GKE Autopilot",
    prefix: "CP-GKE-",
    extract(entries) {
      const cpu = regionPrice(entries["CP-GKE-AUTOPILOT-CPU"]);
      const memory = regionPrice(entries["CP-GKE-AUTOPILOT-MEMORY"]);
      const storage = regionPrice(entries["CP-GKE-AUTOPILOT-EPHEMERAL-STORAGE"]);
      if (!cpu && !memory) return undefined;
      return { cpu, memory, storage };
    },
  },
  {
    technology: "Google BigQuery",
    prefix: "CP-BIGQUERY-",
    extract(entries) {
      const onDemand = regionPrice(entries["CP-BIGQUERY-ANALYSIS"]);
      const activeStorage = regionPrice(entries["CP-BIGQUERY-ACTIVE-STORAGE"]);
      const longTermStorage = regionPrice(entries["CP-BIGQUERY-LONG-TERM-STORAGE"]);
      if (!onDemand && !activeStorage) return undefined;
      return { onDemand, activeStorage, longTermStorage };
    },
  },
  {
    technology: "Google Dataflow",
    prefix: "CP-DATAFLOW-",
    extract(entries) {
      const batchCpu = regionPrice(entries["CP-DATAFLOW-BATCH-VCPU"]);
      const streamingCpu = regionPrice(entries["CP-DATAFLOW-STREAMING-VCPU"]);
      const memory = regionPrice(entries["CP-DATAFLOW-MEMORY"]);
      if (!batchCpu && !streamingCpu) return undefined;
      return { batchCpu, streamingCpu, memory };
    },
  },
  {
    technology: "GCP Cloud Scheduler",
    prefix: "CP-CLOUD-SCHEDULER-",
    extract(entries) {
      const perJob = regionPrice(entries["CP-CLOUD-SCHEDULER-JOB"]);
      if (!perJob) return undefined;
      return { perJob };
    },
  },
];

// ─── Price update helpers ───────────────────────────────────────────────────

function formatPrice(value: number, unit: string): string {
  if (value === 0) return "$0";
  if (value < 0.0001) return `$${value.toFixed(8)}/${unit}`;
  if (value < 0.01) return `$${value.toFixed(5)}/${unit}`;
  if (value < 1) return `$${value.toFixed(4)}/${unit}`;
  return `$${value.toFixed(2)}/${unit}`;
}

/**
 * Apply live prices from the GCP pricing JSON to the static data.
 * Returns a new TechnologyPricing with updated tier prices where available.
 */
function applyLivePrices(
  technology: string,
  base: TechnologyPricing,
  priceList: Record<string, GcpSkuPricing>,
): TechnologyPricing {
  const mapping = SKU_MAPPINGS.find((m) => m.technology === technology);
  if (!mapping) return base;

  const skus = matchSkus(priceList, mapping.prefix);
  const extracted = mapping.extract(skus);
  if (!extracted) return base;

  // Clone base tiers to avoid mutating static data
  const updatedTiers = base.tiers.map((tier) => ({ ...tier }));

  // Apply extracted prices based on technology-specific logic
  switch (technology) {
    case "Google Cloud Firestore": {
      const { reads, writes, deletes, storage } = extracted;
      if (reads != null) {
        const tier = updatedTiers.find((t) => t.name === "Reads");
        if (tier) tier.price = formatPrice(reads * 100_000, "100,000");
      }
      if (writes != null) {
        const tier = updatedTiers.find((t) => t.name === "Writes");
        if (tier) tier.price = formatPrice(writes * 100_000, "100,000");
      }
      if (deletes != null) {
        const tier = updatedTiers.find((t) => t.name === "Deletes");
        if (tier) tier.price = formatPrice(deletes * 100_000, "100,000");
      }
      if (storage != null) {
        const tier = updatedTiers.find((t) => t.name === "Storage");
        if (tier) tier.price = formatPrice(storage, "GB-month");
      }
      break;
    }

    case "Google Cloud Storage": {
      const { standard, nearline, coldline, archive } = extracted;
      if (standard != null) {
        const tier = updatedTiers.find((t) => t.name === "Standard (single region)");
        if (tier) tier.price = formatPrice(standard, "GB-month");
      }
      if (nearline != null) {
        const tier = updatedTiers.find((t) => t.name === "Nearline");
        if (tier) tier.price = formatPrice(nearline, "GB-month");
      }
      if (coldline != null) {
        const tier = updatedTiers.find((t) => t.name === "Coldline");
        if (tier) tier.price = formatPrice(coldline, "GB-month");
      }
      if (archive != null) {
        const tier = updatedTiers.find((t) => t.name === "Archive");
        if (tier) tier.price = formatPrice(archive, "GB-month");
      }
      break;
    }

    case "GCP Cloud CDN": {
      const { cacheEgress, cacheFill } = extracted;
      if (cacheEgress != null) {
        const tier = updatedTiers.find((t) => t.name.startsWith("Cache Egress"));
        if (tier) tier.price = formatPrice(cacheEgress, "GiB");
      }
      if (cacheFill != null) {
        const tier = updatedTiers.find((t) => t.name.startsWith("Cache Fill"));
        if (tier) tier.price = formatPrice(cacheFill, "GiB");
      }
      break;
    }

    case "GCP Cloud DNS": {
      const { zone, queries } = extracted;
      if (zone != null) {
        const tier = updatedTiers.find((t) => t.name.startsWith("Zone"));
        if (tier) tier.price = formatPrice(zone, "zone/month");
      }
      if (queries != null) {
        const tier = updatedTiers.find((t) => t.name === "Queries");
        if (tier) tier.price = formatPrice(queries, "million");
      }
      break;
    }

    case "GCP Cloud Armor": {
      const { policy, rule, requests } = extracted;
      if (policy != null) {
        const tier = updatedTiers.find((t) => t.name === "Standard Policy");
        if (tier) tier.price = formatPrice(policy, "policy/month");
      }
      if (rule != null) {
        const tier = updatedTiers.find((t) => t.name === "Standard Rule");
        if (tier) tier.price = formatPrice(rule, "rule/month");
      }
      if (requests != null) {
        const tier = updatedTiers.find((t) => t.name === "Standard Requests");
        if (tier) tier.price = formatPrice(requests, "million");
      }
      break;
    }

    case "Google Pub/Sub": {
      const { messageDelivery } = extracted;
      if (messageDelivery != null) {
        const tier = updatedTiers.find((t) => t.name === "Message Delivery");
        if (tier) tier.price = formatPrice(messageDelivery, "TiB");
      }
      break;
    }

    case "Google Cloud Functions": {
      const { invocations, memory, cpu } = extracted;
      if (invocations != null) {
        const tier = updatedTiers.find((t) => t.name === "Invocations");
        if (tier) tier.price = formatPrice(invocations * 1_000_000, "million");
      }
      if (memory != null) {
        const tier = updatedTiers.find((t) => t.name.startsWith("Memory"));
        if (tier) tier.price = formatPrice(memory, "GB-sec");
      }
      if (cpu != null) {
        const tier = updatedTiers.find((t) => t.name.startsWith("CPU"));
        if (tier) tier.price = formatPrice(cpu, "GHz-sec");
      }
      break;
    }

    case "Google Cloud Run": {
      const { cpu, memory, requests } = extracted;
      if (cpu != null) {
        const tier = updatedTiers.find((t) => t.name.startsWith("CPU"));
        if (tier) tier.price = formatPrice(cpu, "vCPU-sec");
      }
      if (memory != null) {
        const tier = updatedTiers.find((t) => t.name.startsWith("Memory"));
        if (tier) tier.price = formatPrice(memory, "GiB-sec");
      }
      if (requests != null) {
        const tier = updatedTiers.find((t) => t.name === "Requests");
        if (tier) tier.price = formatPrice(requests * 1_000_000, "million");
      }
      break;
    }

    case "GKE Autopilot": {
      const { cpu, memory, storage } = extracted;
      if (cpu != null) {
        const tier = updatedTiers.find((t) => t.name === "CPU");
        if (tier) tier.price = formatPrice(cpu, "vCPU-hr");
      }
      if (memory != null) {
        const tier = updatedTiers.find((t) => t.name === "Memory");
        if (tier) tier.price = formatPrice(memory, "GiB-hr");
      }
      if (storage != null) {
        const tier = updatedTiers.find((t) => t.name === "Ephemeral Storage");
        if (tier) tier.price = formatPrice(storage, "GiB-hr");
      }
      break;
    }

    case "Google BigQuery": {
      const { onDemand, activeStorage, longTermStorage } = extracted;
      if (onDemand != null) {
        const tier = updatedTiers.find((t) => t.name === "On-Demand Queries");
        if (tier) tier.price = formatPrice(onDemand, "TiB scanned");
      }
      if (activeStorage != null) {
        const tier = updatedTiers.find((t) => t.name === "Active Storage");
        if (tier) tier.price = `${formatPrice(activeStorage, "GB-month")} (logical)`;
      }
      if (longTermStorage != null) {
        const tier = updatedTiers.find((t) => t.name === "Long-Term Storage");
        if (tier) tier.price = `${formatPrice(longTermStorage, "GB-month")} (logical)`;
      }
      break;
    }

    case "Google Dataflow": {
      const { batchCpu, streamingCpu, memory } = extracted;
      if (batchCpu != null) {
        const tier = updatedTiers.find((t) => t.name === "Batch vCPU");
        if (tier) tier.price = formatPrice(batchCpu, "vCPU-hr");
      }
      if (streamingCpu != null) {
        const tier = updatedTiers.find((t) => t.name === "Streaming vCPU");
        if (tier) tier.price = formatPrice(streamingCpu, "vCPU-hr");
      }
      if (memory != null) {
        const tier = updatedTiers.find((t) => t.name === "Memory");
        if (tier) tier.price = formatPrice(memory, "GB-hr");
      }
      break;
    }

    case "GCP Cloud Scheduler": {
      const { perJob } = extracted;
      if (perJob != null) {
        const tier = updatedTiers.find((t) => t.name === "Per Job");
        if (tier) tier.price = formatPrice(perJob, "job/month");
      }
      break;
    }
  }

  return { ...base, tiers: updatedTiers };
}

// GCP Cloud Load Balancing does not have a well-known SKU prefix in the
// pricing calculator JSON, so it always uses static data.

// ─── Fetcher export ─────────────────────────────────────────────────────────

export const fetcher: Fetcher = {
  name: "gcp",
  description: "Google Cloud Platform services via public pricing data",
  technologies: Object.keys(STATIC),

  async fetch(): Promise<FetchResult[]> {
    const results: FetchResult[] = [];
    let priceList: Record<string, GcpSkuPricing> | undefined;

    try {
      log("Fetching GCP pricing calculator data...");
      const data = await fetchJson<GcpPriceList>(GCP_PRICING_URL, "GCP pricing calculator");
      priceList = data.gcp_price_list;
      if (data.updated) {
        log(`  GCP pricing data last updated: ${data.updated}`);
      }
      log(`  Loaded ${Object.keys(priceList).length} SKU entries`);
    } catch (err) {
      warn(`Failed to fetch live GCP pricing: ${(err as Error).message}`);
      warn("Falling back to static pricing data for all GCP technologies");
    }

    for (const [technology, staticPricing] of Object.entries(STATIC)) {
      let pricing: TechnologyPricing;

      if (priceList) {
        try {
          pricing = applyLivePrices(technology, staticPricing, priceList);
          if (pricing !== staticPricing) {
            log(`  Updated live prices for ${technology}`);
          }
        } catch (err) {
          warn(`Error extracting prices for ${technology}: ${(err as Error).message}`);
          pricing = staticPricing;
        }
      } else {
        pricing = staticPricing;
      }

      results.push(
        toResult(
          technology,
          pricing,
          priceList ? GCP_PRICING_URL : "static",
        ),
      );
    }

    log(`GCP fetcher complete: ${results.length} technologies`);
    return results;
  },
};
