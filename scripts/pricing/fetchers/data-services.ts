import type { Fetcher, FetchResult, TechnologyPricing } from "../types.ts";
import { log, toResult } from "../utils.ts";

// Data services: messaging, streaming, warehouses, and search engines.
// Mix of managed services and open-source — no unified pricing API.

const SOURCES: Record<string, string> = {
  "Apache Kafka": "https://www.confluent.io/pricing/",
  RabbitMQ: "https://www.cloudamqp.com/plans.html",
  NATS: "https://www.synadia.com/pricing",
  "Apache Pulsar": "https://streamnative.io/pricing",
  "Redis Streams": "https://redis.io/pricing/",
  Snowflake: "https://www.snowflake.com/pricing/",
  "Databricks (Lakehouse)": "https://www.databricks.com/pricing",
  ClickHouse: "https://clickhouse.com/pricing",
  "Apache Druid": "https://imply.io/pricing/",
  DuckDB: "https://duckdb.org/",
  Elasticsearch: "https://www.elastic.co/pricing",
  Algolia: "https://www.algolia.com/pricing/",
  Pinecone: "https://www.pinecone.io/pricing/",
  Typesense: "https://cloud.typesense.org/pricing",
  Meilisearch: "https://www.meilisearch.com/pricing",
  "Apache Solr": "https://solr.apache.org/",
};

const STATIC: Record<string, TechnologyPricing> = {
  // ─── MESSAGING & STREAMING ──────────────────────────────────────────────────

  "Apache Kafka": {
    model:
      "Confluent Cloud: eCKU-based elastic capacity (Basic/Standard/Enterprise) or CKU-based fixed capacity (Dedicated). Plus networking and storage.",
    unit: "eCKU (elastic Confluent Kafka Unit) — auto-scaling capacity charged per eCKU-hour. CKU (Dedicated) — pre-provisioned block of resources (~250 MB/s ingress, ~750 MB/s egress). Networking + storage billed separately.",
    tiers: [
      {
        name: "Basic",
        price: "First eCKU free; then $0.14/eCKU-hr",
        description: "Dev/test, ~$0/mo start, 1,500 partitions",
      },
      {
        name: "Standard",
        price: "$0.75/eCKU-hr",
        description: "~$385/mo min, 2,500 partitions, 99.9–99.99% SLA",
      },
      {
        name: "Enterprise",
        price: "$1.75–$2.25/eCKU-hr",
        description: "~$895/mo min, 96K partitions, 99.99% SLA",
      },
      { name: "Networking", price: "$0.014–$0.05/GB", description: "Data in/out, varies by tier" },
      { name: "Storage", price: "$0.03–$0.08/GB-month", description: "Retained data" },
    ],
    freeTier: "Basic cluster: first eCKU free, suitable for development",
    modes: [
      {
        name: "Dedicated Clusters",
        priceImpact: "CKU-based (contact sales)",
        description: "Tenant-exclusive brokers, VPC peering",
      },
      {
        name: "Exactly-Once Semantics",
        priceImpact: "No pricing premium",
        description: "Feature flag on Standard+, no extra charge",
      },
    ],
  },

  RabbitMQ: {
    model:
      "Amazon MQ: broker instance-hour + EBS storage. Single-instance or 3-node cluster for HA.",
    unit: "Broker node-hour. Each node in a cluster billed independently.",
    tiers: [
      { name: "mq.t3.micro (single)", price: "$0.034/hr", description: "2 vCPU, 1 GB — dev only" },
      { name: "mq.m5.large", price: "$0.276/hr", description: "2 vCPU, 8 GB — per node" },
      {
        name: "mq.m7g.large (Graviton)",
        price: "~$0.248/hr",
        description: "~12% cheaper than m5, recommended",
      },
      { name: "EBS Storage", price: "$0.10/GB-month", description: "Default 200 GB per node" },
    ],
    modes: [
      {
        name: "HA (3-node cluster)",
        priceImpact: "3x instance cost",
        description: "3 nodes in different AZs; e.g., m5.large cluster ≈ $703/month",
      },
    ],
  },

  NATS: {
    model:
      "Synadia Cloud: fixed subscription tiers with resource pools (connections, storage, network data). Not per-message.",
    unit: "Monthly plan tier with fixed resource pools. No per-message billing; usage beyond limits is rejected, not billed.",
    tiers: [
      {
        name: "Personal (Free)",
        price: "$0/month",
        description: "10 connections, 10 GiB network, 5 GiB storage",
      },
      {
        name: "Starter",
        price: "$49/month",
        description: "100 connections, 100 GiB network, 10 GiB standard + 1 GiB HA storage",
      },
      {
        name: "Pro",
        price: "$199/month",
        description: "1,000 connections, 1 TiB network, 50 GiB + 10 GiB HA storage",
      },
      {
        name: "Premium",
        price: "$899/month",
        description: "10,000 connections, 2 TiB network, 1 TiB + 100 GiB HA",
      },
    ],
    freeTier: "Personal plan: 10 connections, 10 GiB network — permanently free",
    modes: [
      {
        name: "HA Streams (JetStream)",
        priceImpact: "HA storage billed separately",
        description:
          "Clustered JetStream with replicated state. HA storage is much smaller quota than standard.",
      },
    ],
  },

  "Apache Pulsar": {
    model: "StreamNative Cloud: usage-based (throughput + storage). Three deployment options.",
    unit: "Throughput + storage based. Exact per-unit rates require cost estimator or sales.",
    tiers: [
      {
        name: "Serverless",
        price: "~$73/month",
        description: "Shared infra, autoscales, instant creation",
      },
      { name: "BYOC", price: "~$365/month", description: "Your VPC, managed by StreamNative" },
      { name: "Dedicated", price: "~$505/month", description: "Fully isolated, enterprise SLAs" },
    ],
    modes: [
      {
        name: "Geo-Replication",
        priceImpact: "Custom quote",
        description: "Built into Pulsar; available on Dedicated tier",
      },
      {
        name: "Tiered Storage",
        priceImpact: "Pass-through cloud storage costs",
        description: "Offloads older data to S3/GCS/Azure Blob",
      },
    ],
  },

  "Redis Streams": {
    model:
      "Upstash: per-command pricing. Every Redis command (XADD, XREAD, XREADGROUP, etc.) = 1 billable command.",
    unit: "Commands (same as Upstash Redis). XADD, XREAD, XACK, etc. each count as one command.",
    tiers: [
      { name: "Free", price: "$0/month", description: "500K commands/month, 256 MB" },
      { name: "Pay-as-you-go", price: "$0.20/100K commands", description: "Up to 100 GB storage" },
      {
        name: "Fixed (smallest)",
        price: "$10/month",
        description: "250 MB, 50 GB bandwidth, unlimited commands",
      },
    ],
    freeTier: "500K commands/month permanently free",
  },

  // ─── DATA WAREHOUSES ────────────────────────────────────────────────────────

  Snowflake: {
    model:
      "Credits for compute + per-TB storage. Credits consumed by virtual warehouse size per second (60s min). Storage billed separately.",
    unit: "Snowflake Credit — consumed per hour at a rate set by warehouse size. XS=1 credit/hr, S=2, M=4, L=8, XL=16, 2XL=32, up to 6XL=512 credits/hr. Each size doubles. Dollar cost per credit depends on edition.",
    tiers: [
      {
        name: "Standard Edition",
        price: "~$2.00–$3.10/credit",
        description: "Core SQL, 1-day time travel",
      },
      {
        name: "Enterprise Edition",
        price: "~$3.00–$4.65/credit",
        description: "Multi-cluster warehouses, 90-day time travel, materialized views",
      },
      {
        name: "Business Critical",
        price: "~$4.00–$6.20/credit",
        description: "HIPAA/PCI, private connectivity, Tri-Secret Secure",
      },
      { name: "Storage (on-demand)", price: "~$40/TB-month", description: "US AWS regions" },
      {
        name: "Storage (pre-paid)",
        price: "~$23/TB-month",
        description: "With capacity commitment",
      },
    ],
    freeTier: "$400 in free credits for 30-day trial",
    modes: [
      {
        name: "Annual Capacity Commitment",
        priceImpact: "30–40% cheaper credits",
        description: "Pre-purchase credits at discounted rate",
      },
      {
        name: "Snowpark-Optimized Warehouses",
        priceImpact: "1.5x standard credit rate",
        description: "For ML/Python workloads (e.g., Large = 12 credits/hr vs 8)",
      },
      {
        name: "Serverless Features",
        priceImpact: "1x–2x credit multiplier",
        description: "Snowpipe: 1x. Search Optimization: 2x. No warehouse required.",
      },
    ],
  },

  "Databricks (Lakehouse)": {
    model:
      "Per DBU-hour by workload type and tier. Cloud infrastructure (VMs) billed separately by your cloud provider.",
    unit: "DBU (Databricks Unit) — normalized processing power per hour. Different instance types consume DBUs at different rates. You pay Databricks for DBUs + your cloud provider for VMs (two-bill system).",
    tiers: [
      {
        name: "Jobs Light Compute",
        price: "~$0.07/DBU-hr",
        description: "Lightweight scheduled ETL",
      },
      { name: "Jobs Compute", price: "~$0.15/DBU-hr", description: "Standard batch/ETL pipelines" },
      {
        name: "All-Purpose Compute",
        price: "~$0.55/DBU-hr",
        description: "Interactive notebooks, ML dev (most expensive)",
      },
      { name: "SQL Classic", price: "~$0.22/DBU-hr", description: "BI dashboards, SQL queries" },
      {
        name: "SQL Serverless",
        price: "~$0.70/DBU-hr",
        description: "No cluster management, instant startup",
      },
    ],
    modes: [
      {
        name: "Jobs vs All-Purpose",
        priceImpact: "All-Purpose is 3–7x more expensive",
        description: "Automate workloads as Jobs to save 60–80% on DBU costs",
      },
      {
        name: "Commit Discounts",
        priceImpact: "Significant savings",
        description: "Pre-purchase DBUs for high-volume usage",
      },
    ],
  },

  ClickHouse: {
    model:
      "Usage-based: compute (per 8 GiB RAM increments, per minute) + storage + egress. Scale-to-zero available.",
    unit: "Compute unit-hour (8 GiB RAM increments) + storage (compressed GB) + egress.",
    tiers: [
      {
        name: "Basic",
        price: "~$66/month",
        description: "1 replica, 8 GiB RAM, dev/small departmental",
      },
      { name: "Scale", price: "~$499/month", description: "2+ replicas, autoscaling, HA" },
      {
        name: "Enterprise",
        price: "~$2,669+/month",
        description: "2+ replicas, compliance, large scale",
      },
      { name: "Storage", price: "$25.30/TiB-month", description: "Compressed data, AWS us-east-1" },
    ],
    freeTier: "30-day trial, no credit card required",
  },

  "Apache Druid": {
    model:
      "Imply Polaris: consumption-based (project-hour + per-GB ingestion + deep storage). Self-hosted Druid is free.",
    unit: "Project-hour (compute) + GB ingested (data) + GB-month (storage).",
    tiers: [
      { name: "Starter", price: "$100/month", description: "25 GB, variable performance" },
      { name: "Standard", price: "$600/month", description: "Up to 9.6 TB, 99.9% SLA" },
      { name: "Ingestion (first 1 TB)", price: "$0.35/GB", description: "Decreases with volume" },
      { name: "Ingestion (>10 TB)", price: "$0.15/GB", description: "Bulk volume discount" },
      { name: "Deep Storage", price: "$0.06–$0.08/GB-month", description: "Varies by region" },
    ],
    freeTier: "$500 trial credits (30 days). Self-hosted: Apache 2.0 license, free.",
  },

  DuckDB: {
    model:
      "Free and open source (MIT license). MotherDuck (cloud): platform fee + compute + storage.",
    unit: "Free (embedded). MotherDuck: compute units + GB-month storage + AI units.",
    tiers: [
      {
        name: "DuckDB (Embedded)",
        price: "Free",
        description: "MIT license, in-process analytics engine",
      },
      {
        name: "MotherDuck Lite",
        price: "$0/month",
        description: "10 GB storage + 10 compute hours, 3 users",
      },
      {
        name: "MotherDuck Business",
        price: "$250/month + usage",
        description: "Compute + storage pay-as-you-go on top",
      },
      {
        name: "MotherDuck Storage",
        price: "$0.04/GB-month",
        description: "Compressed data, US East",
      },
    ],
    freeTier: "DuckDB: fully free. MotherDuck Lite: 10 GB + 10 compute hrs/month.",
  },

  // ─── SEARCH ENGINES ─────────────────────────────────────────────────────────

  Elasticsearch: {
    model:
      "Elastic Cloud: ECU-based (annual) or RAM-hour (PAYG). ECUs span Hosted and Serverless deployments.",
    unit: "ECU (Elastic Consumption Unit) = $1.00 USD. Pre-purchase ECUs annually; usage deducted from balance. Measures RAM-hours (Hosted) or ingestion/search ops (Serverless).",
    tiers: [
      {
        name: "Hot Data Nodes",
        price: "~$0.10–$0.15/GB RAM/hr",
        description: "High-memory compute for active data",
      },
      { name: "Warm Nodes", price: "Lower", description: "Disk-heavy, less RAM" },
      {
        name: "Cold/Frozen Nodes",
        price: "Cheapest",
        description: "Data on S3, searched on demand",
      },
    ],
    modes: [
      {
        name: "Subscription Tiers",
        priceImpact: "Affects features, not per-unit rate",
        description: "Standard → Gold → Platinum → Enterprise: support and feature access",
      },
      {
        name: "Annual ECU Pre-Purchase",
        priceImpact: "Discounted vs PAYG",
        description: "Multi-year agreements yield further discounts",
      },
    ],
  },

  Typesense: {
    model:
      "Per-cluster-hour (resource-based). RAM is primary cost driver. No per-query or per-record fees.",
    unit: "Cluster-hour. You provision RAM + CPU; pay hourly. Unlike Algolia, no per-search charges.",
    tiers: [
      { name: "Smallest Cluster", price: "~$7/month", description: "0.5 GB RAM" },
      {
        name: "Production (small)",
        price: "~$40+/month",
        description: "Managed with more resources",
      },
    ],
    freeTier: "720 hours trial (30 days continuous), 10 GB bandwidth, no credit card",
    modes: [
      {
        name: "High Availability (3-node)",
        priceImpact: "~3x single-node cost",
        description: "Each node billed independently",
      },
    ],
  },

  Meilisearch: {
    model:
      "Usage-based (per search/documents) or Resource-based (per CPU/RAM). Choose at subscription time.",
    unit: "Search requests + documents (Usage-based) or vCPU + RAM (Resource-based).",
    tiers: [
      {
        name: "Build (Usage-based)",
        price: "$30/month",
        description: "50K searches + 100K documents",
      },
      { name: "XS (Resource-based)", price: "$20.44/month", description: "0.5 vCPU, 1 GB RAM" },
      { name: "M (Resource-based)", price: "$81.03/month", description: "2 vCPU, 4 GB RAM" },
      { name: "XL (Resource-based)", price: "$353.32/month", description: "4 vCPU, 16 GB RAM" },
    ],
    freeTier: "Self-hosted: fully free (open source). Cloud: 14-day free trial.",
  },

  Algolia: {
    model: "Per search request + per indexed record. Two independent usage meters.",
    unit: "Search Request — a group of one or more search operations in a single API exchange. Multi-index federated search counts as 1 request (not per-index). Record — one item/object in an index.",
    tiers: [
      { name: "Build (Free)", price: "$0/month", description: "10K requests + 1M records" },
      {
        name: "Grow Requests",
        price: "$0.50/1,000 requests",
        description: "After 10K included free",
      },
      {
        name: "Grow Records",
        price: "$0.40/1,000 records",
        description: "After 100K included free",
      },
      {
        name: "Grow Plus",
        price: "$1.75/1,000 requests",
        description: "3.5x Grow; adds AI Ranking, Personalization",
      },
      {
        name: "Elevate/Premium",
        price: "Custom (annual)",
        description: "NeuralSearch, 99.999% SLA",
      },
    ],
    freeTier: "10K search requests + 1M records/month — permanently free",
  },

  "Apache Solr": {
    model: "Open source (free). SearchStax for managed hosting.",
    unit: "Free (self-hosted). SearchStax: plan-based starting ~$299/month.",
    tiers: [
      { name: "Open Source", price: "Free", description: "Apache License 2.0, Lucene-based" },
      {
        name: "SearchStax Managed",
        price: "From ~$299/month",
        description: "Managed Solr hosting",
      },
    ],
  },

  Pinecone: {
    model:
      "Serverless consumption-based. Per Read Unit (RU), Write Unit (WU), and GB-month storage.",
    unit: "Read Unit (RU) — consumed per 1 GB of namespace scanned per query (0.25 RU minimum/query). Write Unit (WU) — consumed for upsert/update/delete. Reads cost 4–6x more than writes because vector similarity search is compute-intensive.",
    tiers: [
      {
        name: "Starter (Free)",
        price: "$0/month",
        description: "2 GB storage + 1M RUs + 2M WUs/month",
      },
      {
        name: "Standard Storage",
        price: "$0.33/GB-month",
        description: "Persistent vector storage",
      },
      {
        name: "Standard Read Units",
        price: "$16–$18/million",
        description: "Varies by cloud/region",
      },
      {
        name: "Standard Write Units",
        price: "$4.00–$4.50/million",
        description: "Varies by cloud/region",
      },
      {
        name: "Enterprise Read Units",
        price: "$24–$27/million",
        description: "99.95% SLA, HIPAA, CMK",
      },
    ],
    freeTier: "2 GB storage + 1M RUs + 2M WUs/month — permanently free, no credit card",
  },
};

export const fetcher: Fetcher = {
  name: "data-services",
  description: "Messaging, streaming, data warehouses, and search engines",
  technologies: Object.keys(STATIC),
  async fetch(): Promise<FetchResult[]> {
    log("Data services: using static reference data");
    return Object.entries(STATIC).map(([tech, pricing]) =>
      toResult(tech, pricing, SOURCES[tech] ?? "vendor pricing page"),
    );
  },
};
