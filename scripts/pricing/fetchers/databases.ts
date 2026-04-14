import type { Fetcher, FetchResult, TechnologyPricing } from "../types.ts";
import { log, toResult } from "../utils.ts";

// Independent database vendors — each has their own pricing page.
// No unified API available; prices maintained as reference data.

const SOURCES: Record<string, string> = {
  MongoDB: "https://www.mongodb.com/pricing",
  Cassandra: "https://www.datastax.com/pricing",
  CockroachDB: "https://www.cockroachlabs.com/pricing/",
  TiDB: "https://www.pingcap.com/tidb-cloud-pricing/",
  ScyllaDB: "https://www.scylladb.com/pricing/",
  Neo4j: "https://neo4j.com/pricing/",
  InfluxDB: "https://www.influxdata.com/influxdb-pricing/",
  Couchbase: "https://www.couchbase.com/pricing/",
};

const STATIC: Record<string, TechnologyPricing> = {
  MongoDB: {
    model:
      "Cluster-based, billed hourly. Three tiers: Free (M0), Flex (pay-as-you-go), Dedicated (provisioned clusters).",
    unit: "Cluster-hour. Dedicated clusters are priced as 3-node replica sets (HA included). Flex tier is billed by ops/sec capacity.",
    tiers: [
      { name: "M0 (Free)", price: "$0/month", description: "512 MB storage, shared CPU/RAM" },
      {
        name: "Flex",
        price: "$0.011–$0.041/hr",
        description: "~$8–$30/month, auto-scaling by ops/sec",
      },
      {
        name: "M10 (Dedicated)",
        price: "$0.08/hr (~$57/mo)",
        description: "2 GB RAM, 10 GB storage",
      },
      {
        name: "M30 (Dedicated)",
        price: "$0.54/hr (~$389/mo)",
        description: "8 GB RAM, 40 GB storage",
      },
      {
        name: "M50 (Dedicated)",
        price: "$2.00/hr (~$1,440/mo)",
        description: "32 GB RAM, 160 GB storage",
      },
      {
        name: "M200 (Dedicated)",
        price: "$14.59/hr (~$10,505/mo)",
        description: "256 GB RAM, 1.5 TB storage",
      },
    ],
    freeTier: "M0 cluster: 512 MB storage, permanently free, no credit card required",
    modes: [
      {
        name: "Multi-Region / Global Clusters",
        priceImpact: "Per-region cluster cost stacks",
        description: "Data replicated across regions, each billed at full cluster rate",
      },
    ],
  },

  Cassandra: {
    model:
      "AWS Keyspaces: Serverless per-request or provisioned capacity (RCU/WCU like DynamoDB). DataStax Astra: serverless or dedicated.",
    unit: "WCU/RCU for Keyspaces. 1 WCU = 1 write/sec for rows ≤1 KB at LOCAL_QUORUM. 1 RCU = 1 read/sec for rows ≤4 KB. LOCAL_ONE reads cost half.",
    tiers: [
      { name: "Keyspaces Storage", price: "~$0.25/GB-month", description: "Single-region" },
      {
        name: "DataStax Astra Serverless",
        price: "Pay-per-read/write",
        description: "Usage-based, auto-scaling",
      },
      {
        name: "DataStax Astra Dedicated",
        price: "Node-based",
        description: "Contact sales for node pricing",
      },
    ],
    modes: [
      {
        name: "LOCAL_ONE reads",
        priceImpact: "50% cheaper than LOCAL_QUORUM",
        description: "Eventual consistency reads at half the RCU cost",
      },
      {
        name: "Multi-Region (Keyspaces)",
        priceImpact: "Writes billed per replica region",
        description: "Cross-region replication data transfer is free",
      },
    ],
  },

  CockroachDB: {
    model:
      "Three tiers: Basic (serverless, RU-based), Standard (provisioned vCPUs), Advanced (dedicated).",
    unit: "Request Unit (RU) — an abstraction of compute + I/O consumed by a SQL operation. Heavier queries (full table scans, large writes) consume more RUs.",
    tiers: [
      {
        name: "Basic (Free)",
        price: "$0/month",
        description: "$15/month credit ≈ 50M RUs + 10 GiB storage per org",
      },
      { name: "Basic Compute", price: "~$1–$2/million RUs", description: "Region-dependent" },
      { name: "Basic Storage", price: "~$0.50/GiB-month", description: "Up to 3 TiB" },
      {
        name: "Standard",
        price: "From $0.18/hr",
        description: "2 vCPUs, auto-scaling up to 200 vCPUs",
      },
      {
        name: "Advanced",
        price: "From $0.60/hr",
        description: "4 vCPUs, dedicated infra, enterprise features",
      },
    ],
    freeTier:
      "$15/month credit on Basic (~50M RUs + 10 GiB storage). $400 trial credits for new accounts.",
    modes: [
      {
        name: "Multi-Region",
        priceImpact: "~3x single-region cost",
        description: "Each region's compute and storage billed separately",
      },
    ],
  },

  TiDB: {
    model:
      "Starter: serverless RU-based. Dedicated: node-based with separate TiDB (compute), TiKV (row storage), TiFlash (columnar) nodes.",
    unit: "Request Unit (RU) — abstracts compute + I/O per SQL operation. Or node-hour for dedicated clusters.",
    tiers: [
      { name: "Starter Compute", price: "$0.10/million RUs", description: "US regions" },
      { name: "Starter Row Storage", price: "$0.20/GiB-month", description: "TiKV" },
      { name: "Starter Columnar Storage", price: "$0.05/GiB-month", description: "TiFlash" },
      {
        name: "Dedicated TiDB 4vCPU",
        price: "$0.4416/hr",
        description: "4 vCPU / 16 GB compute node",
      },
      {
        name: "Dedicated TiKV 8vCPU",
        price: "$1.3708/hr",
        description: "8 vCPU / 64 GB storage node",
      },
      { name: "Dedicated Storage", price: "~$0.142/GiB-month", description: "Standard NVMe" },
    ],
    freeTier: "50M RUs/month + 5 GiB row + 5 GiB columnar per cluster (up to 5 clusters/org)",
    modes: [
      {
        name: "Dedicated minimum cluster",
        priceImpact: "~$5.68/hr",
        description: "Typically 2 TiDB + 3 TiKV nodes minimum",
      },
    ],
  },

  ScyllaDB: {
    model:
      "Instance-based per node-hour. Minimum 3-node cluster for replication. No per-request billing.",
    unit: "Node-hour. ScyllaDB does NOT charge per individual read/write operation. You pay for the instance type (vCPU/RAM) + NVMe SSD storage.",
    tiers: [
      { name: "Standard Plan", price: "On-demand per node", description: "8x5 support, 99.9% SLA" },
      {
        name: "Professional Plan",
        price: "On-demand per node",
        description: "24x7 support, multi-region active-active",
      },
      {
        name: "Premium Plan",
        price: "On-demand per node",
        description: "24x7, 15min P1 response, BYOK",
      },
    ],
    modes: [
      {
        name: "1-Year Subscription",
        priceImpact: "Up to 70% savings",
        description: "vs on-demand pricing",
      },
      {
        name: "3-Year Subscription",
        priceImpact: "Further discounts",
        description: "Flex Credits for intermediate savings",
      },
    ],
  },

  Neo4j: {
    model:
      "Capacity-based: per GB of memory provisioned per month. Unusual — price unit reflects in-memory graph working set, not disk storage.",
    unit: "GB of memory/month. This is the provisioned in-memory capacity for your graph database.",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        description: "Limited (~200K nodes+relationships), auto-pauses",
      },
      {
        name: "Professional",
        price: "$65/GB-month",
        description: "Single-zone, 1–128 GB, 7-day backups",
      },
      {
        name: "Business Critical",
        price: "$146/GB-month",
        description: "Multi-zone, 2–512 GB, 99.95% SLA, 30-day backups",
      },
      {
        name: "Virtual Dedicated Cloud",
        price: "Custom",
        description: "Custom isolation, 60-day hourly backups",
      },
    ],
    freeTier: "Small free cluster for learning, no credit card required. Auto-pauses when idle.",
    modes: [
      {
        name: "Business Critical (Multi-Zone HA)",
        priceImpact: "~2.2x Professional cost",
        description: "$146 vs $65 per GB-month; includes RBAC, point-in-time recovery",
      },
    ],
  },

  InfluxDB: {
    model: "Usage-based across four dimensions: data in, query executions, storage, data out.",
    unit: "MB written (data in), queries executed, GB-hours (storage), GB (egress).",
    tiers: [
      { name: "Data In", price: "$0.0025/MB written", description: "Write ingestion cost" },
      { name: "Queries", price: "$0.012 per 100 queries", description: "Query execution cost" },
      { name: "Storage", price: "~$1.46/GB-month", description: "$0.002/GB-hour" },
      { name: "Data Out", price: "$0.09/GB", description: "Egress cost" },
    ],
    freeTier:
      "Free plan: 5 MB writes/5 min, 300 MB query/5 min, 30-day retention, 2 buckets. No credit card.",
  },

  Couchbase: {
    model:
      "Credit-based. Credits consumed per hour based on cluster configuration (nodes, specs, region, plan).",
    unit: "Credits/hour. Credit consumption depends on cloud region, node count, RAM/vCPU, storage IOPS, and service plan tier.",
    tiers: [
      { name: "Basic Plan", price: "Community support", description: "Entry-level" },
      { name: "Developer Pro", price: "Business-hours support", description: "Mid-tier" },
      {
        name: "Enterprise",
        price: "24x7 SLA, dedicated support",
        description: "Full enterprise features",
      },
    ],
    freeTier: "30-day free trial, no credit card required initially",
  },
};

export const fetcher: Fetcher = {
  name: "databases",
  description: "Independent database vendors (static reference data)",
  technologies: Object.keys(STATIC),
  async fetch(): Promise<FetchResult[]> {
    log("Databases: using static reference data");
    return Object.entries(STATIC).map(([tech, pricing]) =>
      toResult(tech, pricing, SOURCES[tech] ?? "vendor pricing page"),
    );
  },
};
