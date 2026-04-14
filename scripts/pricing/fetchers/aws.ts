import type { Fetcher, FetchResult, TechnologyPricing } from "../types.ts";
import { fetchJson, log, warn, toResult, withRetry, formatUsd, parallelLimit } from "../utils.ts";

// ── AWS Bulk Pricing API types ──────────────────────────────────────────────

interface AwsProduct {
  sku: string;
  productFamily: string;
  attributes: Record<string, string>;
}

interface AwsPriceDimension {
  rateCode: string;
  description: string;
  unit: string;
  pricePerUnit: { USD?: string };
}

interface AwsOfferTerm {
  offerTermCode: string;
  sku: string;
  priceDimensions: Record<string, AwsPriceDimension>;
}

interface AwsPricingData {
  products: Record<string, AwsProduct>;
  terms: {
    OnDemand?: Record<string, Record<string, AwsOfferTerm>>;
  };
}

const AWS_PRICING_BASE = "https://pricing.us-east-1.amazonaws.com";
const REGION = "us-east-1";

// ── Helpers ─────────────────────────────────────────────────────────────────

function getOnDemandPrice(data: AwsPricingData, sku: string): number | undefined {
  const offers = data.terms.OnDemand?.[sku];
  if (!offers) return undefined;
  for (const offer of Object.values(offers)) {
    for (const dim of Object.values(offer.priceDimensions)) {
      const usd = dim.pricePerUnit.USD;
      if (usd && parseFloat(usd) > 0) return parseFloat(usd);
    }
  }
  return undefined;
}

function findProducts(
  data: AwsPricingData,
  criteria: Record<string, string>,
): Array<{ product: AwsProduct; price: number }> {
  const results: Array<{ product: AwsProduct; price: number }> = [];
  for (const product of Object.values(data.products)) {
    let match = true;
    for (const [key, value] of Object.entries(criteria)) {
      const actual = key === "productFamily" ? product.productFamily : product.attributes[key];
      if (actual !== value) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    const price = getOnDemandPrice(data, product.sku);
    if (price !== undefined) results.push({ product, price });
  }
  return results;
}

async function fetchAwsService(serviceCode: string): Promise<AwsPricingData> {
  return withRetry(async () => {
    const regionIndex = await fetchJson<{
      regions: Record<string, { currentVersionUrl: string }>;
    }>(
      `${AWS_PRICING_BASE}/offers/v1.0/aws/${serviceCode}/current/region_index.json`,
      `${serviceCode} region index`,
    );
    const url = regionIndex.regions[REGION]?.currentVersionUrl;
    if (!url) throw new Error(`No ${REGION} pricing for ${serviceCode}`);
    return fetchJson<AwsPricingData>(
      `${AWS_PRICING_BASE}${url}`,
      `${serviceCode} ${REGION} pricing (large file)`,
    );
  });
}

// ── Static pricing data ─────────────────────────────────────────────────────
// Source of truth for descriptions, free tiers, and modes.
// Tier prices are updated from the API when available.

const STATIC: Record<string, TechnologyPricing> = {
  // ─── DATABASES (RDS) ──────────────────────────────────────────────────────

  PostgreSQL: {
    model: "Instance-based, billed per second with 10-minute minimum",
    unit: "DB instance-hour. You provision a specific instance type (vCPU + RAM) and pay hourly for compute, plus per-GB storage and I/O.",
    tiers: [
      { name: "db.t4g.micro", price: "$0.016/hr", description: "2 vCPU, 1 GB RAM — dev/test" },
      { name: "db.t4g.medium", price: "$0.068/hr", description: "2 vCPU, 4 GB RAM" },
      {
        name: "db.m7g.large",
        price: "$0.168/hr",
        description: "2 vCPU, 8 GB RAM — general purpose",
      },
      {
        name: "db.r7g.large",
        price: "$0.239/hr",
        description: "2 vCPU, 16 GB RAM — memory optimized",
      },
      {
        name: "gp3 Storage",
        price: "$0.115/GB-month",
        description: "3,000 IOPS baseline included",
      },
      {
        name: "io2 Provisioned IOPS",
        price: "$0.125/GB-month + $0.10/IOPS-month",
        description: "High-performance storage",
      },
    ],
    freeTier: "750 hrs/month db.t3.micro + 20 GB gp2 storage (12 months, new AWS accounts)",
    modes: [
      {
        name: "Multi-AZ (1 standby)",
        priceImpact: "~2x compute cost",
        description: "Synchronous standby in a second AZ for automatic failover",
      },
      {
        name: "Multi-AZ (2 readable standbys)",
        priceImpact: "~3x compute cost",
        description: "3-node cluster with read scaling across AZs",
      },
      {
        name: "Reserved Instances (1yr)",
        priceImpact: "~29% savings",
        description: "No Upfront 1-year commitment",
      },
      {
        name: "Reserved Instances (3yr)",
        priceImpact: "~53% savings",
        description: "All Upfront 3-year commitment",
      },
    ],
  },

  MySQL: {
    model: "Instance-based, billed per second (identical structure to RDS PostgreSQL)",
    unit: "DB instance-hour. Same instance pricing as PostgreSQL on RDS in most regions.",
    tiers: [
      { name: "db.t4g.micro", price: "$0.016/hr", description: "2 vCPU, 1 GB RAM" },
      { name: "db.t4g.medium", price: "$0.068/hr", description: "2 vCPU, 4 GB RAM" },
      { name: "db.m7g.large", price: "$0.168/hr", description: "2 vCPU, 8 GB RAM" },
      {
        name: "gp3 Storage",
        price: "$0.115/GB-month",
        description: "3,000 IOPS baseline included",
      },
    ],
    freeTier: "750 hrs/month db.t3.micro + 20 GB gp2 storage (12 months)",
    modes: [
      {
        name: "Multi-AZ",
        priceImpact: "~2x compute cost",
        description: "Synchronous standby replica",
      },
      {
        name: "Extended Support (MySQL 5.7)",
        priceImpact: "+$0.10/vCPU-hr",
        description: "EOL version surcharge: ~$292/mo extra for m5.large",
      },
    ],
  },

  MariaDB: {
    model: "AWS RDS: identical pricing to RDS MySQL. SkySQL: vCPU-hour + GiB-month storage.",
    unit: "DB instance-hour (RDS) or vCPU-hour (SkySQL).",
    tiers: [
      { name: "RDS db.t4g.micro", price: "$0.016/hr", description: "2 vCPU, 1 GB RAM" },
      { name: "RDS db.m5.large", price: "~$0.171/hr", description: "2 vCPU, 8 GB RAM" },
      {
        name: "SkySQL",
        price: "~$0.45–$10.14/hr",
        description: "10 SKU options; annual contracts 15–30% off",
      },
    ],
    freeTier: "RDS: 750 hrs/month db.t3.micro + 20 GB (12 months)",
    modes: [
      {
        name: "Multi-AZ (RDS)",
        priceImpact: "2x compute cost",
        description: "Synchronous standby",
      },
    ],
  },

  "Amazon Aurora": {
    model:
      "Provisioned instances (like RDS) or Serverless v2 (auto-scaling ACUs). Two storage modes: Standard and I/O-Optimized.",
    unit: "ACU (Aurora Capacity Unit). 1 ACU ≈ 2 GiB RAM + proportional CPU + networking. Serverless v2 scales in 0.5 ACU increments, billed per ACU-second. Can scale to 0 ACUs when idle.",
    tiers: [
      {
        name: "Serverless v2 (Standard)",
        price: "$0.12/ACU-hr",
        description: "I/O charged at $0.20/million requests",
      },
      {
        name: "Serverless v2 (I/O-Optimized)",
        price: "$0.156/ACU-hr",
        description: "I/O is FREE; switch when I/O > 25% of bill",
      },
      { name: "Standard Storage", price: "$0.10/GB-month", description: "Aurora Standard mode" },
      {
        name: "I/O-Optimized Storage",
        price: "$0.225/GB-month",
        description: "Higher storage cost, zero I/O cost",
      },
      { name: "Provisioned db.r6g.large", price: "$0.260/hr", description: "2 vCPU, 16 GB RAM" },
      {
        name: "Provisioned db.r6g.2xlarge",
        price: "$1.038/hr",
        description: "8 vCPU, 64 GB RAM",
      },
    ],
    freeTier: "$100 in Aurora PostgreSQL Serverless v2 credits for new AWS accounts",
    modes: [
      {
        name: "Multi-AZ Reader Instances",
        priceImpact: "Each reader billed separately",
        description: "Add read replicas in other AZs for HA and read scaling",
      },
      {
        name: "Global Database",
        priceImpact: "Per-region reader instance cost",
        description: "Reader instances in secondary regions; <1s replication lag",
      },
    ],
  },

  "Oracle Database": {
    model:
      "AWS RDS: instance-hour with License Included (SE2) or BYOL. Oracle Cloud: ECPU-hour billing.",
    unit: "ECPU (Elastic Compute Unit) on Oracle Cloud. AWS RDS instance-hour varies by license model. LI adds ~2–3x the compute-only cost.",
    tiers: [
      {
        name: "AWS RDS (BYOL, m5.large)",
        price: "~$0.15/hr",
        description: "Bring your own Oracle license",
      },
      {
        name: "AWS RDS (LI SE2, m5.large)",
        price: "~$0.475/hr",
        description: "License included — Oracle SE2 only",
      },
      {
        name: "Oracle Cloud ATP/ADW",
        price: "$0.336/ECPU-hr",
        description: "Autonomous Transaction Processing / Data Warehouse",
      },
      {
        name: "Oracle Cloud JSON",
        price: "$0.0807/ECPU-hr",
        description: "Autonomous JSON Database",
      },
      {
        name: "OCI Storage",
        price: "$0.0025/GB-month",
        description: "Autonomous Database storage",
      },
    ],
    freeTier:
      "Oracle Cloud Always Free: 2 Autonomous DBs with 1 OCPU + 20 GB each — permanently free",
    modes: [
      {
        name: "Multi-AZ (RDS)",
        priceImpact: "2x compute cost",
        description: "Synchronous standby for automatic failover",
      },
      {
        name: "RAC (Oracle Cloud)",
        priceImpact: "Additional ECPU charge",
        description: "Real Application Clusters for high availability and scalability",
      },
    ],
  },

  // ─── NOSQL ────────────────────────────────────────────────────────────────

  DynamoDB: {
    model:
      "Two capacity modes: On-Demand (per-request) or Provisioned (per-second throughput reservation). Storage billed separately.",
    unit: "RCU (Read Capacity Unit) / WCU (Write Capacity Unit). 1 WCU = 1 write/sec for items ≤1 KB. 1 RCU = 1 strongly consistent read/sec for items ≤4 KB (or 2 eventually consistent reads/sec). On-demand uses WRU/RRU (request units) billed per individual operation. Transactional reads/writes cost 2x.",
    tiers: [
      {
        name: "On-Demand Writes",
        price: "$1.25/million WRUs",
        description: "1 WRU = 1 write of ≤1 KB",
      },
      {
        name: "On-Demand Reads",
        price: "$0.25/million RRUs",
        description: "1 RRU = 1 strongly consistent read of ≤4 KB; eventually consistent = 0.5 RRU",
      },
      {
        name: "Provisioned WCU",
        price: "$0.00065/WCU/hr",
        description: "Pre-allocated write capacity per second",
      },
      {
        name: "Provisioned RCU",
        price: "$0.00013/RCU/hr",
        description: "Pre-allocated read capacity per second",
      },
      { name: "Standard Storage", price: "$0.25/GB-month", description: "First 25 GB free" },
      {
        name: "Standard-IA Storage",
        price: "$0.10/GB-month",
        description: "Infrequent access table class",
      },
      {
        name: "DAX (cache)",
        price: "~$0.265/hr",
        description: "dax.r5.large in-memory cache node",
      },
    ],
    freeTier:
      "25 provisioned WCUs + 25 RCUs + 25 GB storage — permanently free (not 12-month)",
    modes: [
      {
        name: "Global Tables (Multi-Region)",
        priceImpact: "Same per-write cost per region",
        description:
          "Replicated writes (rWRUs) at $1.25/million; cross-region transfer billed separately",
      },
      {
        name: "Strongly Consistent Reads",
        priceImpact: "1 RRU per 4 KB",
        description:
          "Default is eventually consistent at 0.5 RRU — strong consistency doubles read cost",
      },
      {
        name: "Transactional Operations",
        priceImpact: "2x WRU/RRU cost",
        description:
          "TransactWriteItems/TransactGetItems consume double the capacity units",
      },
    ],
  },

  // ─── STORAGE ──────────────────────────────────────────────────────────────

  "Amazon S3": {
    model:
      "Per GB stored/month by storage class + per-request fees (PUT/GET per 1,000) + egress charges.",
    unit: "GB-month for storage. Requests per 1,000 operations. GB for egress. Storage classes range from $0.023/GB (Standard) to $0.00099/GB (Deep Archive).",
    tiers: [
      {
        name: "Standard (first 50 TB)",
        price: "$0.023/GB-month",
        description: "Sub-ms latency, 3-AZ",
      },
      {
        name: "Standard-IA",
        price: "$0.0125/GB-month",
        description: "30-day min + $0.01/GB retrieval",
      },
      { name: "One Zone-IA", price: "$0.01/GB-month", description: "Single AZ, 20% cheaper" },
      {
        name: "Glacier Instant Retrieval",
        price: "$0.004/GB-month",
        description: "Millisecond retrieval, 90-day min",
      },
      {
        name: "Glacier Flexible",
        price: "$0.0036/GB-month",
        description: "Minutes to hours retrieval",
      },
      {
        name: "Glacier Deep Archive",
        price: "$0.00099/GB-month",
        description: "Cheapest; 12–48 hr retrieval, 180-day min",
      },
      {
        name: "Intelligent-Tiering",
        price: "Same as Standard when frequent",
        description: "Auto-moves data; $0.0025/1,000 objects monitoring fee",
      },
      {
        name: "Egress (first 10 TB)",
        price: "$0.09/GB",
        description: "S3 → CloudFront is free",
      },
    ],
    freeTier: "5 GB Standard + 20K GET + 2K PUT + 100 GB egress/month (12 months)",
  },

  "Amazon EFS": {
    model:
      "Per GB stored/month by storage class + per-GB read/write charges + optional provisioned throughput.",
    unit: "GB-month. Significantly more expensive than S3 because it provides POSIX NFS shared file system access.",
    tiers: [
      { name: "Standard", price: "$0.30/GB-month", description: "Frequently accessed" },
      {
        name: "Infrequent Access",
        price: "$0.016/GB-month",
        description: "Auto-tiered after inactivity",
      },
      { name: "Archive", price: "$0.008/GB-month", description: "Long-lived data" },
      { name: "Reads", price: "$0.03/GB", description: "All storage classes" },
      { name: "Writes", price: "$0.06/GB", description: "All storage classes" },
      {
        name: "Provisioned Throughput",
        price: "~$6.00/MB/s-month",
        description: "Optional pre-specified throughput",
      },
    ],
    freeTier: "5 GB EFS Standard/month (12 months)",
  },

  "Amazon EBS": {
    model:
      "Per GB provisioned/month (charged for full size even if unused) + IOPS/throughput charges for some types.",
    unit: "GB-month provisioned + IOPS-month + MB/s-month. gp3 is 20% cheaper than gp2 with independent IOPS/throughput provisioning.",
    tiers: [
      {
        name: "gp3 (GP SSD)",
        price: "$0.08/GB-month",
        description: "3,000 IOPS + 125 MB/s free; +$0.005/IOPS, +$0.04/MB/s above",
      },
      {
        name: "io2 Block Express",
        price: "$0.125/GB-month",
        description: "+ tiered IOPS: $0.065/IOPS (first 32K), $0.046 (32K–64K)",
      },
      {
        name: "st1 (Throughput HDD)",
        price: "$0.045/GB-month",
        description: "Sequential workloads, 40 MB/s per TB",
      },
      {
        name: "sc1 (Cold HDD)",
        price: "$0.015/GB-month",
        description: "Lowest cost, 12 MB/s per TB",
      },
      {
        name: "Snapshots (Standard)",
        price: "$0.05/GB-month",
        description: "Incremental, only changed blocks",
      },
      {
        name: "Snapshots (Archive)",
        price: "$0.0125/GB-month",
        description: "75% cheaper for compliance/rare restore",
      },
    ],
    freeTier: "30 GB gp2/magnetic + 2M I/Os + 1 GB snapshots (12 months)",
  },

  // ─── CDN ──────────────────────────────────────────────────────────────────

  "AWS CloudFront": {
    model: "Pay-as-you-go per GB egress + per request. Or flat-rate monthly plans.",
    unit: "Per GB data transfer out to internet + per 10,000 requests. Rates vary by geographic region.",
    tiers: [
      {
        name: "US/EU Egress (first 10 TB)",
        price: "$0.085/GB",
        description: "North America, Europe",
      },
      {
        name: "Asia Pacific Egress",
        price: "$0.120/GB",
        description: "HK, SG, JP, KR, TW, etc.",
      },
      { name: "HTTPS Requests", price: "$0.01 per 10,000", description: "US/Europe" },
      {
        name: "Flat-Rate Pro",
        price: "$15/month",
        description: "50 TB transfer + 10M requests included",
      },
      {
        name: "Origin Shield",
        price: "~$0.009/GB",
        description: "Optional: reduces origin load",
      },
    ],
    freeTier:
      "1 TB egress + 10M requests + 2M CloudFront Function invocations/month — permanently free",
    modes: [
      {
        name: "S3 → CloudFront transfer",
        priceImpact: "Free",
        description: "No inter-service egress from S3 to CloudFront",
      },
    ],
  },

  // ─── SERVERLESS ───────────────────────────────────────────────────────────

  "AWS Lambda": {
    model: "Per request + per GB-second of duration. Billed per millisecond.",
    unit: "GB-second — combines memory and time. 512 MB function running 2 seconds = 1.0 GB-second. You choose memory (128 MB–10 GB); CPU scales proportionally. ARM/Graviton is 20% cheaper.",
    tiers: [
      { name: "Requests", price: "$0.20/million", description: "Per invocation" },
      { name: "Duration (x86)", price: "$0.0000166667/GB-sec", description: "Per millisecond" },
      {
        name: "Duration (ARM)",
        price: "$0.0000133334/GB-sec",
        description: "20% cheaper + better performance",
      },
      {
        name: "Provisioned Concurrency (idle)",
        price: "$0.0000041667/GB-sec",
        description: "Warm instance capacity charge (24/7)",
      },
      {
        name: "Provisioned Concurrency (active)",
        price: "$0.0000097222/GB-sec",
        description: "When actually executing",
      },
    ],
    freeTier: "1M requests + 400,000 GB-seconds/month — permanently free (not 12-month)",
    modes: [
      {
        name: "Provisioned Concurrency",
        priceImpact: "Idle charge 24/7 + reduced active rate",
        description:
          "Eliminates cold starts; capacity charge accrues whether traffic arrives or not",
      },
      {
        name: "ARM/Graviton2",
        priceImpact: "20% lower price + up to 34% better perf",
        description: "Requires only a runtime config change",
      },
      {
        name: "Compute Savings Plans (1yr)",
        priceImpact: "Up to 17% savings",
        description: "Commit to consistent spend for duration charges",
      },
    ],
  },

  // ─── MESSAGE QUEUES ───────────────────────────────────────────────────────

  "Amazon SQS": {
    model:
      "Per API request. Every SendMessage, ReceiveMessage, DeleteMessage, etc. counts. Each 64 KB chunk = 1 request.",
    unit: "API request (64 KB chunks). A 65 KB message = 2 requests.",
    tiers: [
      {
        name: "Standard Queue",
        price: "$0.40/million requests",
        description: "At-least-once, best-effort ordering",
      },
      {
        name: "FIFO Queue",
        price: "$0.50/million requests",
        description: "Exactly-once, strict ordering (25% premium)",
      },
    ],
    freeTier: "1 million requests/month — permanently free for every AWS account",
    modes: [
      {
        name: "FIFO Queues",
        priceImpact: "+$0.10/million requests",
        description:
          "Strict ordering within Message Group ID + dedup within 5-min window",
      },
      {
        name: "FIFO Throughput Limit",
        priceImpact: "Capped at 3,000 msg/sec with batching",
        description: "300 msg/sec without batching vs unlimited for Standard",
      },
    ],
  },

  // ─── CACHES ───────────────────────────────────────────────────────────────

  Redis: {
    model:
      "AWS ElastiCache: node-based (per-hour) or Serverless (ECPU + GB-hour). Redis Cloud: memory-based per hour/month.",
    unit: "ElastiCache node-hour OR ECPU (ElastiCache Processing Unit). 1 ECPU = 1 KB of data transferred per command. Serverless Valkey is 33% cheaper than Serverless Redis OSS.",
    tiers: [
      {
        name: "ElastiCache cache.t4g.micro",
        price: "$0.016/hr",
        description: "~$11.50/month, burstable",
      },
      {
        name: "ElastiCache cache.r7g.large",
        price: "$0.250/hr",
        description: "~$180/month, memory-optimized",
      },
      {
        name: "Serverless (Valkey) Storage",
        price: "$0.084/GB-hr",
        description: "Auto-scaling, built-in HA",
      },
      {
        name: "Serverless (Valkey) Requests",
        price: "$0.0023/million ECPUs",
        description: "1 ECPU per KB transferred",
      },
      {
        name: "Redis Cloud Essentials",
        price: "From $0.007/hr (~$5/mo)",
        description: "Shared infra, 250 MB–100 GB",
      },
      {
        name: "Redis Cloud Pro",
        price: "From $0.014/hr ($200/mo min)",
        description: "Dedicated infra, unlimited RAM",
      },
      {
        name: "Upstash Redis",
        price: "$0.20/100K commands",
        description: "Per-command serverless pricing",
      },
    ],
    freeTier: "Redis Cloud: 30 MB free forever. Upstash: 500K commands/month free.",
    modes: [
      {
        name: "HA / Read Replicas",
        priceImpact: "2–3x node cost",
        description: "Each replica = full node billed independently",
      },
      {
        name: "Reserved Instances (3yr)",
        priceImpact: "Up to 55% savings",
        description: "All Upfront 3-year commitment on ElastiCache",
      },
      {
        name: "Extended Support (Redis OSS)",
        priceImpact: "+80% surcharge",
        description:
          "Redis OSS EOL 2026; additional 80% on base node price for extended support",
      },
    ],
  },

  Memcached: {
    model:
      "AWS ElastiCache node-hour based. No Serverless mode. No encryption, persistence, or HA replication.",
    unit: "Cache node-hour. Same node pricing structure as Redis OSS (not Valkey-discounted).",
    tiers: [
      { name: "cache.t4g.micro", price: "$0.016/hr", description: "~$11.50/month" },
      {
        name: "cache.r7g.xlarge",
        price: "$0.350/hr",
        description: "~$252/month, memory-optimized",
      },
    ],
    modes: [
      {
        name: "No built-in HA",
        priceImpact: "Lower base cost",
        description:
          "Memcached has no replication — data lost on node failure. Cheaper for pure horizontal cache.",
      },
      {
        name: "Reserved Instances",
        priceImpact: "Up to 55% savings",
        description: "Same tiers as ElastiCache Redis",
      },
    ],
  },

  // ─── FIREWALLS & SECURITY ─────────────────────────────────────────────────

  "AWS WAF": {
    model:
      "Per Web ACL + per rule + per million requests. Bot Control and Fraud Control are add-on subscriptions.",
    unit: "Web ACL/month + rules/month + requests/million.",
    tiers: [
      { name: "Web ACL", price: "$5.00/month", description: "Per web ACL" },
      { name: "Rules", price: "$1.00/month each", description: "Per custom rule or rule group" },
      { name: "Requests", price: "$0.60/million", description: "Processed by web ACL" },
      {
        name: "Bot Control",
        price: "$10/month/ACL + $1.00/million",
        description: "Common bot protection",
      },
      {
        name: "Targeted Bot Control",
        price: "$10/month/ACL + $10.00/million",
        description: "Advanced bot detection",
      },
    ],
  },

  "AWS Security Groups": {
    model: "Free. Core VPC feature with no charge.",
    unit: "No charge. Up to 2,500 SGs per VPC, 60 inbound + 60 outbound rules per SG.",
    tiers: [
      {
        name: "All Usage",
        price: "Free",
        description: "Stateful packet filtering included at no cost",
      },
    ],
  },

  // ─── DNS ──────────────────────────────────────────────────────────────────

  "AWS Route 53": {
    model: "Per hosted zone/month + per DNS query (tiered by volume and query type).",
    unit: "Hosted zones/month + queries/million. Alias records to AWS services are free.",
    tiers: [
      {
        name: "Hosted Zone (first 25)",
        price: "$0.50/zone/month",
        description: "10K records included",
      },
      { name: "Standard Queries", price: "$0.40/million", description: "First 1B/month" },
      {
        name: "Latency-Based Routing",
        price: "$0.60/million",
        description: "First 1B/month",
      },
      {
        name: "Geolocation Queries",
        price: "$0.70/million",
        description: "First 1B/month",
      },
      {
        name: "Alias Records",
        price: "Free",
        description: "Queries to AWS services (ELB, CloudFront, S3)",
      },
    ],
  },

  // ─── CONTAINERS ───────────────────────────────────────────────────────────

  "Amazon ECS": {
    model:
      "ECS control plane is free. You pay for EC2 instances (EC2 launch type) or Fargate vCPU+memory (Fargate launch type).",
    unit: "EC2 instance-hours or Fargate vCPU-hr + GB-hr. ECS orchestration layer is $0.",
    tiers: [
      {
        name: "ECS Control Plane",
        price: "Free",
        description: "Container orchestration at no charge",
      },
      {
        name: "Fargate (1 vCPU + 2 GB)",
        price: "~$36/month",
        description: "On-demand, 24/7",
      },
      {
        name: "EC2 m5.xlarge",
        price: "~$140/month on-demand",
        description: "4 vCPU, 16 GB — must manage instance",
      },
      {
        name: "EC2 m5.xlarge (1yr RI)",
        price: "~$85/month",
        description: "Reserved Instance commitment",
      },
      {
        name: "ECS Anywhere",
        price: "$0.01025/hr per instance",
        description: "On-premises registered instances",
      },
    ],
    modes: [
      {
        name: "Fargate vs EC2",
        priceImpact: "Fargate ~20–30% premium",
        description:
          "Fargate: no management overhead. EC2: cheaper with RIs at high utilization.",
      },
    ],
  },

  "AWS Fargate": {
    model:
      "Per vCPU-hour + per GB-hour, billed per second (1-min minimum). Serverless containers for ECS/EKS.",
    unit: "vCPU-hour + GB-hour. Pricing starts when container images are pulled.",
    tiers: [
      {
        name: "vCPU (Linux x86)",
        price: "$0.04048/hr",
        description: "~$29.55/month per vCPU",
      },
      {
        name: "Memory (Linux x86)",
        price: "$0.004445/GB-hr",
        description: "~$3.24/month per GB",
      },
      {
        name: "vCPU (ARM/Graviton)",
        price: "$0.03239/hr",
        description: "~20% cheaper than x86",
      },
      { name: "Memory (ARM)", price: "$0.003556/GB-hr", description: "~20% cheaper" },
      {
        name: "Ephemeral Storage",
        price: "$0.000111/GB-hr",
        description: "Above 20 GB free per task",
      },
    ],
    modes: [
      {
        name: "Fargate Spot",
        priceImpact: "Up to 70% discount",
        description: "Interruptible with 2-min notice; for batch/stateless tasks",
      },
    ],
  },

  // ─── LOAD BALANCERS ───────────────────────────────────────────────────────

  "AWS ALB": {
    model: "Fixed hourly rate + LCU (Load Balancer Capacity Unit) consumption charge.",
    unit: "LCU — the ALB measures 4 dimensions simultaneously and charges whichever consumes the most: (1) New connections: 25/sec per LCU, (2) Active connections: 3,000/min per LCU, (3) Bandwidth: 1 GB/hr per LCU, (4) Rule evaluations: 1,000/sec per LCU.",
    tiers: [
      { name: "Hourly Rate", price: "$0.0225/hr", description: "~$16.20/month baseline" },
      {
        name: "LCU",
        price: "$0.008/LCU-hr",
        description: "Charged for highest dimension each hour",
      },
    ],
    freeTier: "750 hours/month + 15 LCUs/month for ALB (12 months)",
  },

  "AWS NLB": {
    model: "Fixed hourly rate + NLCU (Network LB Capacity Unit) consumption charge.",
    unit: "NLCU — Layer 4 capacity unit. TCP: 800 new flows/sec, 100K active/min, 1 GB/hr per NLCU. TLS: 50 new connections/sec, 3K active/min per NLCU. NLB is 25% cheaper per capacity unit than ALB.",
    tiers: [
      { name: "Hourly Rate", price: "$0.0252/hr", description: "~$18.14/month baseline" },
      { name: "NLCU", price: "$0.006/NLCU-hr", description: "TCP/UDP/TLS Layer 4 capacity" },
    ],
  },

  // ─── STREAMING ────────────────────────────────────────────────────────────

  "AWS Kinesis Data Streams": {
    model:
      "Three modes: Provisioned (per-shard-hour), On-Demand Standard (per-GB), On-Demand Advantage (lower per-GB).",
    unit: "Shard-hour (Provisioned) — each shard = 1 MB/s write + 2 MB/s read. Or per-GB (On-Demand).",
    tiers: [
      {
        name: "Provisioned Shard-Hour",
        price: "$0.015/shard/hr",
        description: "1 MB/s write + 2 MB/s read per shard",
      },
      {
        name: "PUT Payload Units",
        price: "$0.014/million",
        description: "Each record rounded to nearest 25 KB",
      },
      {
        name: "On-Demand Standard Ingestion",
        price: "$0.08/GB",
        description: "Auto-scales, no shard management",
      },
      {
        name: "On-Demand Advantage Ingestion",
        price: "$0.032/GB",
        description: "60% cheaper; requires 25 MB/s minimum commitment",
      },
      {
        name: "Enhanced Fan-Out",
        price: "$0.015/consumer-shard-hr + $0.013/GB",
        description: "Dedicated 2 MB/s per consumer",
      },
    ],
    modes: [
      {
        name: "Extended Retention (24h–7d)",
        priceImpact: "$0.10/GB-month",
        description: "Beyond default 24-hour retention",
      },
      {
        name: "Long-Term Retention (7–365d)",
        priceImpact: "$0.023/GB-month",
        description: "Up to 1 year of data retention",
      },
    ],
  },

  "Amazon Kinesis Data Firehose": {
    model:
      "Per GB ingested. Serverless, no provisioning. 5 KB per-record minimum rounding for Direct PUT.",
    unit: "GB ingested. A 1 KB record is billed as 5 KB (5x multiplier for tiny payloads). Batch records to save costs.",
    tiers: [
      {
        name: "Direct PUT / KDS Source",
        price: "$0.029/GB",
        description: "Records rounded to nearest 5 KB",
      },
      {
        name: "MSK Source",
        price: "$0.055/GB",
        description: "No rounding; billed on higher of ingested vs delivered",
      },
      {
        name: "Vended Logs",
        price: "$0.13/GB",
        description: "CloudWatch, VPC Flow Logs, etc.",
      },
      { name: "Format Conversion", price: "$0.018/GB", description: "JSON → Parquet/ORC" },
      {
        name: "Snowflake Destination",
        price: "$0.071/GB",
        description: "Direct to Snowflake",
      },
    ],
  },

  // ─── API GATEWAY ──────────────────────────────────────────────────────────

  "AWS API Gateway": {
    model:
      "Pay-per-request + data transfer. Three distinct APIs: HTTP API (cheapest), REST API (full features), WebSocket API.",
    unit: "API calls (per million). HTTP API is ~3.5x cheaper than REST API.",
    tiers: [
      {
        name: "HTTP API",
        price: "$1.00/million calls",
        description: "First 300M; fewer features, no caching",
      },
      {
        name: "REST API",
        price: "$3.50/million calls",
        description: "First 333M; caching, usage plans, transforms",
      },
      {
        name: "WebSocket Messages",
        price: "$1.00/million",
        description: "32 KB increments, max 128 KB",
      },
      {
        name: "WebSocket Connection-minutes",
        price: "$0.25/million",
        description: "Per minute of open connection",
      },
      { name: "Data Transfer Out", price: "$0.09/GB", description: "Standard AWS egress" },
      {
        name: "REST API Cache (1.6 GB)",
        price: "$0.038/hr",
        description: "Optional edge cache",
      },
    ],
    freeTier: "1M REST + 1M HTTP + 1M WebSocket messages/month (12 months)",
  },

  // ─── EVENTS / SCHEDULING ──────────────────────────────────────────────────

  "AWS EventBridge": {
    model:
      "Per event (64 KB chunks) published + delivered. Separate pricing for Pipes, API Destinations, Replay.",
    unit: "Events (64 KB chunks). A 256 KB payload = 4 billable events.",
    tiers: [
      { name: "Custom Events", price: "$1.00/million", description: "Ingestion + delivery" },
      {
        name: "Cross-Account Delivery",
        price: "$0.05/million",
        description: "Events sent to another AWS account",
      },
      { name: "Pipes", price: "$0.40/million requests", description: "Event routing" },
      {
        name: "API Destinations",
        price: "$0.20/million invocations",
        description: "To web endpoints",
      },
      {
        name: "Scheduler",
        price: "$1.00/million invocations",
        description: "14M/month free",
      },
    ],
    freeTier: "EventBridge Scheduler: 14M invocations/month permanently free",
  },

  "AWS EventBridge Scheduler": {
    model: "Per invocation. Extremely economical with generous free tier.",
    unit: "Invocations (each scheduled rule firing).",
    tiers: [
      { name: "Invocations", price: "$1.00/million", description: "After free tier" },
    ],
    freeTier: "14,000,000 invocations/month — permanently free",
  },

  // ─── SEARCH ENGINES ───────────────────────────────────────────────────────

  OpenSearch: {
    model:
      "AWS OpenSearch: instance-hour (provisioned) or OCU-hour (serverless). Separate storage charges.",
    unit: "Instance-hour or OCU (OpenSearch Compute Unit). 1 OCU = 6 GB RAM + proportional vCPU + GP3 storage. Serverless minimum: 2 OCUs = ~$346/month.",
    tiers: [
      { name: "t3.small.search", price: "$0.036/hr", description: "2 GB RAM — dev/test" },
      { name: "r6g.large.search", price: "$0.167/hr", description: "16 GB RAM — production" },
      {
        name: "Serverless OCU",
        price: "$0.24/OCU-hr",
        description: "Min 2 OCUs = $0.48/hr ($346/mo min)",
      },
      {
        name: "UltraWarm Storage",
        price: "$0.024/GB-month",
        description: "S3-backed warm tier",
      },
      { name: "Cold Storage", price: "~$0.02/GB-month", description: "S3-based" },
    ],
    modes: [
      {
        name: "Reserved Instances (3yr)",
        priceImpact: "~48% savings",
        description: "No Upfront 3-year",
      },
      {
        name: "Database Savings Plans",
        priceImpact: "~35% savings",
        description: "Launched March 2026, no upfront",
      },
    ],
  },
};

// ── API extraction helpers ──────────────────────────────────────────────────

/** Look up an RDS instance price by databaseEngine + instanceType. */
function extractRdsInstancePrice(
  data: AwsPricingData,
  engine: string,
  instanceType: string,
): number | undefined {
  const hits = findProducts(data, {
    productFamily: "Database Instance",
    databaseEngine: engine,
    instanceType: instanceType,
    deploymentOption: "Single-AZ",
  });
  return hits[0]?.price;
}

/** Extract RDS compute instance prices for a given engine name and update tiers. */
function updateRdsTiers(
  data: AwsPricingData,
  tech: string,
  engine: string,
  pricing: TechnologyPricing,
): void {
  const instanceMap: Record<string, string> = {
    "db.t4g.micro": "db.t4g.micro",
    "db.t4g.medium": "db.t4g.medium",
    "db.m7g.large": "db.m7g.large",
    "db.r7g.large": "db.r7g.large",
    "db.m5.large": "db.m5.large",
    "db.r6g.large": "db.r6g.large",
    "db.r6g.2xlarge": "db.r6g.2xlarge",
  };

  for (const tier of pricing.tiers) {
    // Match tier name to an RDS instance type
    const cleanName = tier.name.replace(/^RDS /, "").replace(/^Provisioned /, "");
    const apiInstanceType = instanceMap[cleanName];
    if (!apiInstanceType) continue;

    const price = extractRdsInstancePrice(data, engine, apiInstanceType);
    if (price !== undefined) {
      tier.price = formatUsd(price, "hr");
      log(`  ${tech} ${tier.name}: ${tier.price}`);
    }
  }
}

/** Extract DynamoDB on-demand pricing. */
function updateDynamoDbTiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  // On-Demand writes
  const writes = findProducts(data, {
    productFamily: "Amazon DynamoDB PayPerRequest Throughput",
    group: "DDB-WriteUnits",
  });
  if (writes[0]) {
    const tier = pricing.tiers.find((t) => t.name === "On-Demand Writes");
    if (tier) {
      tier.price = `$${(writes[0].price * 1_000_000).toFixed(2)}/million WRUs`;
      log(`  DynamoDB On-Demand Writes: ${tier.price}`);
    }
  }

  // On-Demand reads
  const reads = findProducts(data, {
    productFamily: "Amazon DynamoDB PayPerRequest Throughput",
    group: "DDB-ReadUnits",
  });
  if (reads[0]) {
    const tier = pricing.tiers.find((t) => t.name === "On-Demand Reads");
    if (tier) {
      tier.price = `$${(reads[0].price * 1_000_000).toFixed(2)}/million RRUs`;
      log(`  DynamoDB On-Demand Reads: ${tier.price}`);
    }
  }

  // Storage
  const storage = findProducts(data, {
    productFamily: "Database Storage",
    volumeType: "Amazon DynamoDB - Indexed DataStore",
  });
  if (storage[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Standard Storage");
    if (tier) {
      tier.price = formatUsd(storage[0].price, "GB-month");
      log(`  DynamoDB Storage: ${tier.price}`);
    }
  }
}

/** Extract S3 Standard storage price. */
function updateS3Tiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  const standard = findProducts(data, {
    productFamily: "Storage",
    volumeType: "Standard",
    storageClass: "General Purpose",
  });
  if (standard[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Standard (first 50 TB)");
    if (tier) {
      tier.price = formatUsd(standard[0].price, "GB-month");
      log(`  S3 Standard: ${tier.price}`);
    }
  }
}

/** Extract CloudFront US/EU egress. */
function updateCloudFrontTiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  const usEgress = findProducts(data, {
    productFamily: "Data Transfer",
    fromLocation: "United States",
  });
  if (usEgress[0]) {
    const tier = pricing.tiers.find((t) => t.name === "US/EU Egress (first 10 TB)");
    if (tier) {
      tier.price = formatUsd(usEgress[0].price, "GB");
      log(`  CloudFront US/EU Egress: ${tier.price}`);
    }
  }
}

/** Extract Lambda request and duration prices. */
function updateLambdaTiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  // Requests
  const requests = findProducts(data, {
    productFamily: "Serverless",
    group: "AWS-Lambda-Requests",
    operatingSystem: "Linux",
  });
  if (requests[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Requests");
    if (tier) {
      tier.price = `$${(requests[0].price * 1_000_000).toFixed(2)}/million`;
      log(`  Lambda Requests: ${tier.price}`);
    }
  }

  // Duration (x86)
  const durationX86 = findProducts(data, {
    productFamily: "Serverless",
    group: "AWS-Lambda-Duration",
    operatingSystem: "Linux",
  });
  // Filter for non-ARM
  const x86 = durationX86.filter(
    (d) => d.product.attributes["architectureType"] !== "arm64",
  );
  if (x86[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Duration (x86)");
    if (tier) {
      tier.price = `$${x86[0].price.toFixed(10)}/GB-sec`;
      log(`  Lambda Duration (x86): ${tier.price}`);
    }
  }

  // Duration (ARM)
  const arm = durationX86.filter(
    (d) => d.product.attributes["architectureType"] === "arm64",
  );
  if (arm[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Duration (ARM)");
    if (tier) {
      tier.price = `$${arm[0].price.toFixed(10)}/GB-sec`;
      log(`  Lambda Duration (ARM): ${tier.price}`);
    }
  }
}

/** Extract SQS Standard queue price. */
function updateSqsTiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  const standard = findProducts(data, {
    productFamily: "Queue",
    queueType: "Standard",
  });
  if (standard[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Standard Queue");
    if (tier) {
      tier.price = `$${(standard[0].price * 1_000_000).toFixed(2)}/million requests`;
      log(`  SQS Standard: ${tier.price}`);
    }
  }

  const fifo = findProducts(data, {
    productFamily: "Queue",
    queueType: "FIFO",
  });
  if (fifo[0]) {
    const tier = pricing.tiers.find((t) => t.name === "FIFO Queue");
    if (tier) {
      tier.price = `$${(fifo[0].price * 1_000_000).toFixed(2)}/million requests`;
      log(`  SQS FIFO: ${tier.price}`);
    }
  }
}

/** Extract ElastiCache node prices for Redis and Memcached. */
function updateElastiCacheTiers(
  data: AwsPricingData,
  engine: string,
  pricing: TechnologyPricing,
): void {
  const instanceMap: Record<string, string> = {
    "ElastiCache cache.t4g.micro": "cache.t4g.micro",
    "cache.t4g.micro": "cache.t4g.micro",
    "ElastiCache cache.r7g.large": "cache.r7g.large",
    "cache.r7g.xlarge": "cache.r7g.xlarge",
  };

  for (const tier of pricing.tiers) {
    const apiInstanceType = instanceMap[tier.name];
    if (!apiInstanceType) continue;

    const hits = findProducts(data, {
      productFamily: "Cache Instance",
      cacheEngine: engine,
      instanceType: apiInstanceType,
    });
    if (hits[0]) {
      tier.price = formatUsd(hits[0].price, "hr");
      log(`  ${engine} ${tier.name}: ${tier.price}`);
    }
  }
}

/** Extract WAF prices. */
function updateWafTiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  // Web ACL monthly charge
  const acl = findProducts(data, {
    productFamily: "Web Application Firewall",
    group: "AWS-WAF-WebACL",
  });
  if (acl[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Web ACL");
    if (tier) {
      tier.price = formatUsd(acl[0].price, "month");
      log(`  WAF Web ACL: ${tier.price}`);
    }
  }

  // Rule monthly charge
  const rule = findProducts(data, {
    productFamily: "Web Application Firewall",
    group: "AWS-WAF-Rule",
  });
  if (rule[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Rules");
    if (tier) {
      tier.price = `${formatUsd(rule[0].price, "month")} each`;
      log(`  WAF Rule: ${tier.price}`);
    }
  }

  // Request charge
  const req = findProducts(data, {
    productFamily: "Web Application Firewall",
    group: "AWS-WAF-Request",
  });
  if (req[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Requests");
    if (tier) {
      tier.price = `$${(req[0].price * 1_000_000).toFixed(2)}/million`;
      log(`  WAF Requests: ${tier.price}`);
    }
  }
}

/** Extract Route 53 hosted zone and query prices. */
function updateRoute53Tiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  const zone = findProducts(data, {
    productFamily: "DNS Zone",
  });
  if (zone[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Hosted Zone (first 25)");
    if (tier) {
      tier.price = `${formatUsd(zone[0].price, "zone/month")}`;
      log(`  Route 53 Hosted Zone: ${tier.price}`);
    }
  }

  const queries = findProducts(data, {
    productFamily: "DNS Query",
    group: "Route53-Queries",
  });
  if (queries[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Standard Queries");
    if (tier) {
      tier.price = `$${(queries[0].price * 1_000_000).toFixed(2)}/million`;
      log(`  Route 53 Queries: ${tier.price}`);
    }
  }
}

/** Extract ELB (ALB and NLB) hourly rates. */
function updateElbTiers(data: AwsPricingData): void {
  // ALB hourly
  const alb = findProducts(data, {
    productFamily: "Load Balancer-Application",
    usagetype: "USE1-LoadBalancerUsage",
  });
  if (alb[0]) {
    const pricing = STATIC["AWS ALB"];
    const tier = pricing.tiers.find((t) => t.name === "Hourly Rate");
    if (tier) {
      tier.price = formatUsd(alb[0].price, "hr");
      log(`  ALB Hourly Rate: ${tier.price}`);
    }
  }

  // ALB LCU
  const albLcu = findProducts(data, {
    productFamily: "Load Balancer-Application",
    group: "ELB:Balancer-LCU",
  });
  if (albLcu[0]) {
    const pricing = STATIC["AWS ALB"];
    const tier = pricing.tiers.find((t) => t.name === "LCU");
    if (tier) {
      tier.price = formatUsd(albLcu[0].price, "LCU-hr");
      log(`  ALB LCU: ${tier.price}`);
    }
  }

  // NLB hourly
  const nlb = findProducts(data, {
    productFamily: "Load Balancer-Network",
    usagetype: "USE1-LoadBalancerUsage",
  });
  if (nlb[0]) {
    const pricing = STATIC["AWS NLB"];
    const tier = pricing.tiers.find((t) => t.name === "Hourly Rate");
    if (tier) {
      tier.price = formatUsd(nlb[0].price, "hr");
      log(`  NLB Hourly Rate: ${tier.price}`);
    }
  }

  // NLB NLCU
  const nlbLcu = findProducts(data, {
    productFamily: "Load Balancer-Network",
    group: "ELB:Balancer-NLCU",
  });
  if (nlbLcu[0]) {
    const pricing = STATIC["AWS NLB"];
    const tier = pricing.tiers.find((t) => t.name === "NLCU");
    if (tier) {
      tier.price = formatUsd(nlbLcu[0].price, "NLCU-hr");
      log(`  NLB NLCU: ${tier.price}`);
    }
  }
}

/** Extract EBS gp3 storage price. */
function updateEbsTiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  const gp3 = findProducts(data, {
    productFamily: "Storage",
    volumeApiName: "gp3",
  });
  if (gp3[0]) {
    const tier = pricing.tiers.find((t) => t.name === "gp3 (GP SSD)");
    if (tier) {
      tier.price = formatUsd(gp3[0].price, "GB-month");
      log(`  EBS gp3: ${tier.price}`);
    }
  }

  const io2 = findProducts(data, {
    productFamily: "Storage",
    volumeApiName: "io2",
  });
  if (io2[0]) {
    const tier = pricing.tiers.find((t) => t.name === "io2 Block Express");
    if (tier) {
      tier.price = formatUsd(io2[0].price, "GB-month");
      log(`  EBS io2: ${tier.price}`);
    }
  }
}

/** Extract EFS Standard storage price. */
function updateEfsTiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  const standard = findProducts(data, {
    productFamily: "Storage",
    storageClass: "General Purpose",
    accessType: "Standard",
  });
  if (standard[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Standard");
    if (tier) {
      tier.price = formatUsd(standard[0].price, "GB-month");
      log(`  EFS Standard: ${tier.price}`);
    }
  }
}

/** Extract Kinesis Data Streams provisioned shard-hour price. */
function updateKinesisTiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  const shard = findProducts(data, {
    productFamily: "Kinesis Streams",
    group: "Shard-Hours",
  });
  if (shard[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Provisioned Shard-Hour");
    if (tier) {
      tier.price = formatUsd(shard[0].price, "shard/hr");
      log(`  Kinesis Shard-Hour: ${tier.price}`);
    }
  }
}

/** Extract Kinesis Firehose ingestion price. */
function updateFirehoseTiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  const ingestion = findProducts(data, {
    productFamily: "Kinesis Firehose",
    group: "KinesisFirehose-Ingestion",
  });
  if (ingestion[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Direct PUT / KDS Source");
    if (tier) {
      tier.price = formatUsd(ingestion[0].price, "GB");
      log(`  Firehose Ingestion: ${tier.price}`);
    }
  }
}

/** Extract API Gateway HTTP/REST prices. */
function updateApiGatewayTiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  const httpApi = findProducts(data, {
    productFamily: "API Calls",
    group: "ApiGateway-HTTP-Calls",
  });
  if (httpApi[0]) {
    const tier = pricing.tiers.find((t) => t.name === "HTTP API");
    if (tier) {
      tier.price = `$${(httpApi[0].price * 1_000_000).toFixed(2)}/million calls`;
      log(`  API Gateway HTTP: ${tier.price}`);
    }
  }

  const restApi = findProducts(data, {
    productFamily: "API Calls",
    group: "ApiGateway-Calls",
  });
  if (restApi[0]) {
    const tier = pricing.tiers.find((t) => t.name === "REST API");
    if (tier) {
      tier.price = `$${(restApi[0].price * 1_000_000).toFixed(2)}/million calls`;
      log(`  API Gateway REST: ${tier.price}`);
    }
  }
}

/** Extract EventBridge custom event price. */
function updateEventBridgeTiers(data: AwsPricingData): void {
  const events = findProducts(data, {
    productFamily: "EventBridge",
    group: "Custom-Events",
  });
  if (events[0]) {
    const pricing = STATIC["AWS EventBridge"];
    const tier = pricing.tiers.find((t) => t.name === "Custom Events");
    if (tier) {
      tier.price = `$${(events[0].price * 1_000_000).toFixed(2)}/million`;
      log(`  EventBridge Custom Events: ${tier.price}`);
    }

    // Same rate for Scheduler
    const scheduler = STATIC["AWS EventBridge Scheduler"];
    const schedulerTier = scheduler.tiers.find((t) => t.name === "Invocations");
    if (schedulerTier) {
      schedulerTier.price = `$${(events[0].price * 1_000_000).toFixed(2)}/million`;
      log(`  EventBridge Scheduler: ${schedulerTier.price}`);
    }
  }
}

/** Extract Fargate vCPU and memory prices. */
function updateFargateTiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  // vCPU (x86 Linux)
  const vcpu = findProducts(data, {
    productFamily: "Compute",
    operatingSystem: "Linux",
    cpuArchitecture: "x86_64",
    usagetype: "USE1-Fargate-vCPU-Hours:perCPU",
  });
  if (vcpu[0]) {
    const tier = pricing.tiers.find((t) => t.name === "vCPU (Linux x86)");
    if (tier) {
      tier.price = formatUsd(vcpu[0].price, "hr");
      log(`  Fargate vCPU (x86): ${tier.price}`);
    }
  }

  // Memory (x86 Linux)
  const mem = findProducts(data, {
    productFamily: "Compute",
    operatingSystem: "Linux",
    cpuArchitecture: "x86_64",
    usagetype: "USE1-Fargate-GB-Hours",
  });
  if (mem[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Memory (Linux x86)");
    if (tier) {
      tier.price = formatUsd(mem[0].price, "GB-hr");
      log(`  Fargate Memory (x86): ${tier.price}`);
    }
  }

  // vCPU (ARM)
  const vcpuArm = findProducts(data, {
    productFamily: "Compute",
    operatingSystem: "Linux",
    cpuArchitecture: "ARM64",
    usagetype: "USE1-Fargate-ARM-vCPU-Hours:perCPU",
  });
  if (vcpuArm[0]) {
    const tier = pricing.tiers.find((t) => t.name === "vCPU (ARM/Graviton)");
    if (tier) {
      tier.price = formatUsd(vcpuArm[0].price, "hr");
      log(`  Fargate vCPU (ARM): ${tier.price}`);
    }
  }

  // Memory (ARM)
  const memArm = findProducts(data, {
    productFamily: "Compute",
    operatingSystem: "Linux",
    cpuArchitecture: "ARM64",
    usagetype: "USE1-Fargate-ARM-GB-Hours",
  });
  if (memArm[0]) {
    const tier = pricing.tiers.find((t) => t.name === "Memory (ARM)");
    if (tier) {
      tier.price = formatUsd(memArm[0].price, "GB-hr");
      log(`  Fargate Memory (ARM): ${tier.price}`);
    }
  }
}

/** Extract OpenSearch instance prices. */
function updateOpenSearchTiers(data: AwsPricingData, pricing: TechnologyPricing): void {
  const t3Small = findProducts(data, {
    productFamily: "Amazon OpenSearch Service Instance",
    instanceType: "t3.small.search",
  });
  if (t3Small[0]) {
    const tier = pricing.tiers.find((t) => t.name === "t3.small.search");
    if (tier) {
      tier.price = formatUsd(t3Small[0].price, "hr");
      log(`  OpenSearch t3.small: ${tier.price}`);
    }
  }

  const r6gLarge = findProducts(data, {
    productFamily: "Amazon OpenSearch Service Instance",
    instanceType: "r6g.large.search",
  });
  if (r6gLarge[0]) {
    const tier = pricing.tiers.find((t) => t.name === "r6g.large.search");
    if (tier) {
      tier.price = formatUsd(r6gLarge[0].price, "hr");
      log(`  OpenSearch r6g.large: ${tier.price}`);
    }
  }
}

// ── Service fetch tasks ─────────────────────────────────────────────────────

interface ServiceTask {
  serviceCode: string;
  label: string;
  extract: (data: AwsPricingData) => void;
}

const SERVICE_TASKS: ServiceTask[] = [
  {
    serviceCode: "AmazonRDS",
    label: "RDS (PostgreSQL, MySQL, MariaDB, Aurora, Oracle)",
    extract: (data) => {
      updateRdsTiers(data, "PostgreSQL", "PostgreSQL", STATIC["PostgreSQL"]);
      updateRdsTiers(data, "MySQL", "MySQL", STATIC["MySQL"]);
      updateRdsTiers(data, "MariaDB", "MariaDB", STATIC["MariaDB"]);
      updateRdsTiers(data, "Aurora", "Aurora PostgreSQL", STATIC["Amazon Aurora"]);
      updateRdsTiers(data, "Oracle", "Oracle", STATIC["Oracle Database"]);
    },
  },
  {
    serviceCode: "AmazonDynamoDB",
    label: "DynamoDB",
    extract: (data) => updateDynamoDbTiers(data, STATIC["DynamoDB"]),
  },
  {
    serviceCode: "AmazonS3",
    label: "S3",
    extract: (data) => updateS3Tiers(data, STATIC["Amazon S3"]),
  },
  {
    serviceCode: "AmazonCloudFront",
    label: "CloudFront",
    extract: (data) => updateCloudFrontTiers(data, STATIC["AWS CloudFront"]),
  },
  {
    serviceCode: "AWSLambda",
    label: "Lambda",
    extract: (data) => updateLambdaTiers(data, STATIC["AWS Lambda"]),
  },
  {
    serviceCode: "AmazonSQS",
    label: "SQS",
    extract: (data) => updateSqsTiers(data, STATIC["Amazon SQS"]),
  },
  {
    serviceCode: "AmazonElastiCache",
    label: "ElastiCache (Redis, Memcached)",
    extract: (data) => {
      updateElastiCacheTiers(data, "Redis", STATIC["Redis"]);
      updateElastiCacheTiers(data, "Memcached", STATIC["Memcached"]);
    },
  },
  {
    serviceCode: "awswaf",
    label: "WAF",
    extract: (data) => updateWafTiers(data, STATIC["AWS WAF"]),
  },
  {
    serviceCode: "AmazonRoute53",
    label: "Route 53",
    extract: (data) => updateRoute53Tiers(data, STATIC["AWS Route 53"]),
  },
  {
    serviceCode: "AmazonECS",
    label: "ECS / Fargate",
    extract: (data) => {
      updateFargateTiers(data, STATIC["AWS Fargate"]);
      // ECS control plane is free; Fargate prices cover compute
    },
  },
  {
    serviceCode: "ElasticLoadBalancing",
    label: "ALB / NLB",
    extract: (data) => updateElbTiers(data),
  },
  {
    serviceCode: "AmazonEBS",
    label: "EBS",
    extract: (data) => updateEbsTiers(data, STATIC["Amazon EBS"]),
  },
  {
    serviceCode: "AmazonEFS",
    label: "EFS",
    extract: (data) => updateEfsTiers(data, STATIC["Amazon EFS"]),
  },
  {
    serviceCode: "AmazonKinesis",
    label: "Kinesis Data Streams",
    extract: (data) => updateKinesisTiers(data, STATIC["AWS Kinesis Data Streams"]),
  },
  {
    serviceCode: "AmazonKinesisFirehose",
    label: "Kinesis Firehose",
    extract: (data) => updateFirehoseTiers(data, STATIC["Amazon Kinesis Data Firehose"]),
  },
  {
    serviceCode: "AmazonApiGateway",
    label: "API Gateway",
    extract: (data) => updateApiGatewayTiers(data, STATIC["AWS API Gateway"]),
  },
  {
    serviceCode: "AWSEvents",
    label: "EventBridge",
    extract: (data) => updateEventBridgeTiers(data),
  },
];

// Note: OpenSearch uses the Elasticsearch service code in the AWS Pricing API
const OPENSEARCH_TASK: ServiceTask = {
  serviceCode: "AmazonES",
  label: "OpenSearch",
  extract: (data) => updateOpenSearchTiers(data, STATIC["OpenSearch"]),
};

// ── Fetcher export ──────────────────────────────────────────────────────────

export const fetcher: Fetcher = {
  name: "aws",
  description: "AWS services via Bulk Pricing API (us-east-1)",
  technologies: Object.keys(STATIC),

  async fetch(): Promise<FetchResult[]> {
    const allTasks = [...SERVICE_TASKS, OPENSEARCH_TASK];

    // Fetch AWS services in parallel (max 3 concurrent) — files can be very large
    const fetchTasks = allTasks.map((task) => async () => {
      try {
        log(`Fetching ${task.label} (${task.serviceCode})...`);
        const data = await fetchAwsService(task.serviceCode);
        task.extract(data);
        log(`  ${task.label}: extraction complete`);
      } catch (err) {
        warn(`${task.label}: API fetch failed, using static prices — ${(err as Error).message}`);
      }
    });

    await parallelLimit(fetchTasks, 3);

    // AWS Security Groups is free — no API needed, always use static
    log("AWS Security Groups: free (no API fetch needed)");

    // Build results from the (potentially updated) STATIC data
    const results: FetchResult[] = [];
    for (const [tech, pricing] of Object.entries(STATIC)) {
      results.push(toResult(tech, pricing, "AWS Bulk Pricing API (us-east-1)"));
    }

    return results;
  },
};
