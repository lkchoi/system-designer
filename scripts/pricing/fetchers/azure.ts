import type { Fetcher, FetchResult, TechnologyPricing, PricingTier } from "../types.ts";
import { fetchJsonPages, log, warn, toResult } from "../utils.ts";

// ── Azure Retail Prices API ─────────────────────────────────────────────────

const AZURE_PRICES_API = "https://prices.azure.com/api/retail/prices";

interface AzurePriceItem {
  currencyCode: string;
  retailPrice: number;
  unitPrice: number;
  armRegionName: string;
  location: string;
  meterName: string;
  productName: string;
  skuName: string;
  serviceName: string;
  serviceFamily: string;
  unitOfMeasure: string;
  type: string;
  isPrimaryMeterRegion: boolean;
}

async function fetchAzurePrices(serviceName: string, extra?: string): Promise<AzurePriceItem[]> {
  let filter = `serviceName eq '${serviceName}' and armRegionName eq 'eastus' and priceType eq 'Consumption'`;
  if (extra) filter += ` and ${extra}`;
  const url = `${AZURE_PRICES_API}?$filter=${encodeURIComponent(filter)}`;
  return fetchJsonPages<AzurePriceItem>(
    url,
    (body) => (body as any).NextPageLink ?? undefined,
    (body) => ((body as any).Items ?? []) as AzurePriceItem[],
  );
}

// ── Static pricing data (copied from src/registry/pricing.ts) ───────────────

const STATIC: Record<string, TechnologyPricing> = {
  "SQL Server": {
    model:
      "Azure SQL: DTU-based (bundled) or vCore-based (separate compute/storage). AWS RDS: instance-based.",
    unit: "DTU (Database Transaction Unit) — bundles CPU, memory, and I/O into a single metric. Or vCore-hour for more granular control.",
    tiers: [
      { name: "Basic (5 DTU)", price: "~$4.90/month", description: "Simple workloads" },
      { name: "Standard S0 (10 DTU)", price: "~$14.72/month", description: "Light production" },
      { name: "Standard S2 (50 DTU)", price: "~$73.74/month", description: "Medium workloads" },
      {
        name: "Premium P1 (125 DTU)",
        price: "~$456/month",
        description: "High-performance, in-memory OLTP",
      },
      {
        name: "General Purpose vCore",
        price: "~$0.52/vCore/hr",
        description: "Separate compute/storage billing",
      },
      {
        name: "Business Critical vCore",
        price: "~$1.53–$4.92/vCore/hr",
        description: "Built-in HA replicas, in-memory OLTP",
      },
      {
        name: "Serverless (auto-pause)",
        price: "~$0.08/vCore/hr when active",
        description: "Scales 0.5–80 vCores; $0 compute when paused",
      },
    ],
    freeTier:
      "32 GB storage + 100,000 vCore-seconds serverless/month — permanently free (one per Azure subscription)",
    modes: [
      {
        name: "Business Critical",
        priceImpact: "~3x General Purpose",
        description: "Includes built-in HA with read replicas, in-memory OLTP",
      },
      {
        name: "Hyperscale",
        priceImpact: "Similar to General Purpose compute",
        description: "Distributed storage architecture for very large databases",
      },
      {
        name: "Azure Hybrid Benefit",
        priceImpact: "~30–55% compute savings",
        description: "Existing SQL Server licenses with Software Assurance",
      },
    ],
  },

  "Azure Cosmos DB": {
    model:
      "Three throughput modes: Provisioned (reserved RU/s), Autoscale (dynamic RU/s), Serverless (per-request RU). Storage billed separately.",
    unit: "Request Unit (RU). 1 RU = cost of a point read (fetch single item by ID) of a 1 KB document. Writes ≈ 5 RUs per 1 KB. Cross-partition queries consume many RUs proportional to data scanned. All operations (reads, writes, queries, stored procedures) are measured in RUs.",
    tiers: [
      {
        name: "Provisioned (single-region)",
        price: "$0.008 per 100 RU/s per hour",
        description: "Minimum 400 RU/s = ~$23/month",
      },
      {
        name: "Serverless",
        price: "$0.25 per million RUs",
        description: "No capacity planning; 5,000 RU/s burst cap",
      },
      { name: "Storage", price: "$0.25/GB-month", description: "All throughput modes" },
    ],
    freeTier: "1,000 RU/s provisioned + 25 GB storage — permanently free (one per subscription)",
    modes: [
      {
        name: "Multi-Region Writes (Multi-Master)",
        priceImpact: "2x RU/s charge",
        description:
          "$0.016 per 100 RU/s per hour — each write applied in all regions simultaneously",
      },
      {
        name: "Autoscale",
        priceImpact: "Same rate, pay for peak",
        description:
          "Scales 10%–100% of max RU/s; often 30–40% cheaper than fixed provisioned for variable traffic",
      },
      {
        name: "Strong Consistency",
        priceImpact: "2x read cost",
        description: "Strong consistency reads consume 2 RUs per 4 KB vs 1 RU for session/eventual",
      },
    ],
  },

  "Azure Functions": {
    model:
      "Three hosting plans: Consumption (serverless), Flex Consumption (configurable), Premium (pre-warmed).",
    unit: "GB-second of execution time + per execution. Consumption plan memory fixed at 1.5 GB.",
    tiers: [
      {
        name: "Consumption Executions",
        price: "$0.20/million",
        description: "First 1M/month free",
      },
      {
        name: "Consumption Duration",
        price: "$0.000016/GB-sec",
        description: "First 400K GB-sec free",
      },
      {
        name: "Flex Consumption",
        price: "$0.000026/GB-sec",
        description: "Configurable memory (512 MB–4 GB)",
      },
      {
        name: "Premium EP1",
        price: "~$0.169/hr",
        description: "1 vCPU, 3.5 GB — always-on, no cold starts",
      },
      { name: "Premium EP2", price: "~$0.338/hr", description: "2 vCPU, 7 GB" },
    ],
    freeTier: "Consumption: 1M executions + 400K GB-sec/month free",
  },

  "Azure Blob Storage": {
    model:
      "Per GB/month by access tier + per-operation + retrieval fees. LRS pricing; GRS ~doubles storage cost.",
    unit: "GB-month by tier. Operations per 10,000 requests.",
    tiers: [
      {
        name: "Hot (first 50 TB, LRS)",
        price: "$0.018/GB-month",
        description: "Frequently accessed data",
      },
      { name: "Cool", price: "$0.013/GB-month", description: "30-day min" },
      { name: "Cold", price: "$0.004/GB-month", description: "90-day min, $0.03/GB retrieval" },
      {
        name: "Archive",
        price: "$0.00099/GB-month",
        description: "180-day min, rehydration required (hours)",
      },
    ],
    freeTier: "5 GB LRS Blob + 20K read + 10K write ops/month (12 months)",
  },

  "Azure CDN": {
    model: "Per GB data transfer out by geographic zone + per-request charges.",
    unit: "Per GB egress by zone.",
    tiers: [
      {
        name: "Zone 1 (US/EU, first 10 TB)",
        price: "$0.087/GB",
        description: "Standard Microsoft tier",
      },
      { name: "Zone 2 (Asia Pacific)", price: "$0.116/GB", description: "First 10 TB" },
      { name: "Zone 3 (South America)", price: "$0.181/GB", description: "First 10 TB" },
    ],
  },

  "Azure Load Balancer": {
    model:
      "Per load-balancing rule (hourly) + data processing. No charge without rules configured.",
    unit: "Per rule/hour. No hourly base charge for the LB itself.",
    tiers: [
      {
        name: "Standard (first 5 rules)",
        price: "$0.025/rule/hr",
        description: "L4 load balancer",
      },
      { name: "Standard (rules 6+)", price: "$0.01/rule/hr", description: "Reduced rate" },
    ],
    modes: [
      {
        name: "Basic SKU",
        priceImpact: "Retired Sept 2025",
        description: "Was free; no longer available for new deployments",
      },
    ],
  },

  "Azure DNS": {
    model: "Per DNS zone/month + per million queries.",
    unit: "Zones/month + queries/million. Nearly identical to Route 53 pricing.",
    tiers: [
      { name: "Zone (first 25)", price: "$0.50/zone/month", description: "Same as Route 53" },
      { name: "Queries", price: "$0.40/million", description: "First 1B/month" },
    ],
  },

  "Azure Firewall": {
    model:
      "Per-hour deployment charge + per-GB data processing. Three tiers: Basic, Standard, Premium.",
    unit: "Deployment-hour + GB processed.",
    tiers: [
      {
        name: "Basic",
        price: "$0.395/hr + $0.065/GB",
        description: "~$284/mo; DNAT/network/app rules, no IDPS",
      },
      {
        name: "Standard",
        price: "$1.25/hr + $0.016/GB",
        description: "~$900/mo; + threat intelligence, DNS proxy",
      },
      {
        name: "Premium",
        price: "$1.75/hr + $0.016/GB",
        description: "~$1,260/mo; + IDPS, TLS inspection, URL filtering",
      },
    ],
  },

  "Azure API Management": {
    model: "Fixed monthly per-unit cost by tier, or Consumption (serverless pay-per-call).",
    unit: "API operations (calls). Consumption: ~$4.20/million after free 1M. Classic tiers: fixed monthly per unit.",
    tiers: [
      {
        name: "Consumption",
        price: "$0.042 per 10,000 ops",
        description: "First 1M calls/month free; no SLA",
      },
      { name: "Developer", price: "~$50/month", description: "Dev/test only, no SLA" },
      { name: "Basic v2", price: "~$143/month", description: "Includes VNet integration" },
      { name: "Standard v2", price: "~$664/month", description: "4x cheaper than old Premium" },
      {
        name: "Premium (Classic)",
        price: "~$2,800/month",
        description: "Multi-region, custom SLA",
      },
    ],
    freeTier: "Consumption tier: first 1M calls/month free",
  },

  "Azure Service Bus": {
    model:
      "Basic/Standard: per-operation. Premium: per Messaging Unit hour (capacity-based, not per-operation).",
    unit: "Operation (API call) on Basic/Standard. MU (Messaging Unit) on Premium — dedicated resources, no noisy-neighbor.",
    tiers: [
      {
        name: "Basic",
        price: "$0.05/million ops",
        description: "Queues only, no topics, no sessions",
      },
      {
        name: "Standard",
        price: "$10/mo + tiered ops",
        description: "First 13M ops included; then $0.80–$0.20/million",
      },
      {
        name: "Premium",
        price: "$0.928/MU/hr (~$668/MU/month)",
        description: "1–4 MUs per namespace, 100 MB max message",
      },
    ],
    modes: [
      {
        name: "FIFO (Sessions)",
        priceImpact: "No premium",
        description: "Available on Standard+, guarantees ordered delivery within a session",
      },
      {
        name: "Exactly-Once (Dedup)",
        priceImpact: "No extra charge",
        description: "Duplicate detection on Standard+; configurable 1–7 day window",
      },
      {
        name: "Premium for HA",
        priceImpact: "MU rate only",
        description: "Geo-disaster recovery + AZ support, no per-feature surcharge",
      },
    ],
  },

  "Azure Logic Apps": {
    model:
      "Consumption: per-action execution. Standard: reserved compute (unlimited built-in ops).",
    unit: "Per action execution (Consumption). Built-in actions: $0.000025/exec. Standard connectors: $0.000125/call. Enterprise: $0.001/call.",
    tiers: [
      {
        name: "Built-in Actions",
        price: "$0.000025/exec",
        description: "HTTP, loops, conditions — first 4K/month free",
      },
      {
        name: "Standard Connectors",
        price: "$0.000125/call",
        description: "External service integrations",
      },
      { name: "Enterprise Connectors", price: "$0.001/call", description: "SAP, Oracle, etc." },
      {
        name: "Standard Plan WS1",
        price: "~$175/month",
        description: "1 vCPU, 3.5 GB — unlimited built-in ops",
      },
      { name: "Standard Plan WS3", price: "~$700/month", description: "4 vCPU, 14 GB" },
    ],
    freeTier: "4,000 built-in action executions/month on Consumption plan",
  },
};

// ── Service name mapping: technology → Azure API serviceName ─────────────────

interface ServiceQuery {
  serviceName: string;
  extra?: string;
}

const SERVICE_MAP: Record<string, ServiceQuery> = {
  "SQL Server": { serviceName: "SQL Database" },
  "Azure Cosmos DB": { serviceName: "Azure Cosmos DB" },
  "Azure Functions": { serviceName: "Functions" },
  "Azure Blob Storage": {
    serviceName: "Storage",
    extra: "contains(productName, 'Blob')",
  },
  "Azure CDN": { serviceName: "Azure CDN" },
  "Azure Load Balancer": { serviceName: "Load Balancer" },
  "Azure DNS": { serviceName: "Azure DNS" },
  "Azure Firewall": { serviceName: "Azure Firewall" },
  "Azure API Management": { serviceName: "API Management" },
  "Azure Service Bus": { serviceName: "Service Bus" },
  "Azure Logic Apps": { serviceName: "Logic Apps" },
};

// ── Tier matching helpers ────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Try to match live API prices back into the static tier structure.
 * Returns a new tiers array with prices updated where a match was found.
 */
function matchTiers(
  staticTiers: PricingTier[],
  apiItems: AzurePriceItem[],
  technology: string,
): PricingTier[] {
  if (apiItems.length === 0) return staticTiers;

  // Build a lookup from normalized meter/sku/product names to prices
  const lookup = new Map<string, AzurePriceItem>();
  for (const item of apiItems) {
    if (!item.isPrimaryMeterRegion) continue;
    // Index by multiple keys so we can fuzzy-match tiers
    const keys = [
      normalize(item.meterName),
      normalize(item.skuName),
      normalize(`${item.skuName} ${item.meterName}`),
      normalize(item.productName),
    ];
    for (const k of keys) {
      if (!lookup.has(k)) lookup.set(k, item);
    }
  }

  return staticTiers.map((tier) => {
    const tierKey = normalize(tier.name);

    // Direct match on tier name
    let match = lookup.get(tierKey);

    // Try partial match: find an API item whose normalized name contains the tier key
    if (!match) {
      for (const [key, item] of lookup) {
        if (key.includes(tierKey) || tierKey.includes(key)) {
          match = item;
          break;
        }
      }
    }

    if (match && match.retailPrice > 0) {
      const price = match.retailPrice;
      const unit = match.unitOfMeasure || "";
      let formatted: string;
      if (price < 0.0001) formatted = `$${price.toFixed(8)}/${unit}`;
      else if (price < 0.01) formatted = `$${price.toFixed(6)}/${unit}`;
      else if (price < 1) formatted = `$${price.toFixed(4)}/${unit}`;
      else if (price < 100) formatted = `$${price.toFixed(2)}/${unit}`;
      else formatted = `$${Math.round(price)}/${unit}`;

      log(`  ${technology} / ${tier.name}: updated to ${formatted} (was ${tier.price})`);
      return { ...tier, price: formatted };
    }

    return tier;
  });
}

// ── Fetcher implementation ──────────────────────────────────────────────────

async function fetchOne(technology: string): Promise<FetchResult> {
  const staticData = STATIC[technology];
  const query = SERVICE_MAP[technology];

  if (!query) {
    warn(`No Azure API mapping for ${technology}, using static data`);
    return toResult(technology, staticData, "static");
  }

  try {
    log(`Fetching Azure prices for ${technology} (${query.serviceName})...`);
    const items = await fetchAzurePrices(query.serviceName, query.extra);
    log(`  Got ${items.length} price items for ${technology}`);

    const updatedTiers = matchTiers(staticData.tiers, items, technology);
    const updatedPricing: TechnologyPricing = { ...staticData, tiers: updatedTiers };
    return toResult(technology, updatedPricing, `Azure Retail Prices API (${query.serviceName})`);
  } catch (err) {
    warn(`Failed to fetch ${technology}: ${(err as Error).message} — using static data`);
    return toResult(technology, staticData, "static (API error)");
  }
}

export const fetcher: Fetcher = {
  name: "azure",
  description:
    "Fetches pricing for Azure-primary technologies via the Azure Retail Prices REST API, falling back to static data on errors.",
  technologies: Object.keys(STATIC),

  async fetch(): Promise<FetchResult[]> {
    log("Azure fetcher: starting...");
    const results: FetchResult[] = [];

    for (const technology of this.technologies) {
      const result = await fetchOne(technology);
      results.push(result);
    }

    log(`Azure fetcher: completed ${results.length} technologies`);
    return results;
  },
};
