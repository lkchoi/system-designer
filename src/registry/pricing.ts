import type { TechnologyPricing } from "../types";

/**
 * Comprehensive pricing data for all technologies in the registry.
 * Keyed by technology name (must match TechnologyInfo.name exactly).
 *
 * Pricing researched April 2026. All prices USD, US East regions unless noted.
 * Always verify against official pricing pages before making purchasing decisions.
 */
export const PRICING: Record<string, TechnologyPricing> = {
  // ─── DATABASES ────────────────────────────────────────────────────────────────

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
    freeTier: "25 provisioned WCUs + 25 RCUs + 25 GB storage — permanently free (not 12-month)",
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
        description: "TransactWriteItems/TransactGetItems consume double the capacity units",
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
      { name: "Provisioned db.r6g.2xlarge", price: "$1.038/hr", description: "8 vCPU, 64 GB RAM" },
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

  SQLite: {
    model:
      "Free (embedded). Turso: per-row-read/write. Cloudflare D1: per-row-read/write within Workers.",
    unit: 'Row reads/writes. A "row read" = each row scanned by a query (full table scan of 5,000 rows = 5,000 reads).',
    tiers: [
      {
        name: "Turso Starter (Free)",
        price: "$0/month",
        description: "500M row reads, 10M writes, 5 GB storage",
      },
      {
        name: "Turso Developer",
        price: "$4.99/month",
        description: "2.5B reads + $1/B overage; 9 GB storage",
      },
      { name: "Turso Scaler", price: "$24.92/month", description: "100B reads; 24 GB storage" },
      {
        name: "D1 (Workers Paid)",
        price: "$5/month base",
        description: "25B reads/month + 50M writes; 5 GB storage",
      },
      {
        name: "D1 Read Overage",
        price: "$0.001/million rows",
        description: "Very cheap read overage",
      },
      {
        name: "D1 Write Overage",
        price: "$1.00/million rows",
        description: "Writes 1000x more expensive than reads",
      },
    ],
    freeTier:
      "D1: 5M reads/day + 100K writes/day + 5 GB. Turso: 500M reads/mo + 10M writes + 5 GB.",
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

  // ─── API GATEWAYS ─────────────────────────────────────────────────────────────

  Kong: {
    model: "Monthly subscription per gateway + per-request overages. Gateway type determines cost.",
    unit: "Gateway service/month + per million API requests.",
    tiers: [
      {
        name: "Plus Plan",
        price: "~$105/month per gateway",
        description: "1M requests included; $200/additional million",
      },
      {
        name: "Enterprise",
        price: "Custom (annual)",
        description: "Unlimited gateways, portals, SSO, dedicated TAM",
      },
    ],
    freeTier: "30-day trial with full Enterprise features",
  },

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
      { name: "REST API Cache (1.6 GB)", price: "$0.038/hr", description: "Optional edge cache" },
    ],
    freeTier: "1M REST + 1M HTTP + 1M WebSocket messages/month (12 months)",
  },

  Nginx: {
    model: "Open source (free) or NGINX Plus commercial subscription per instance.",
    unit: "Per instance/year for NGINX Plus.",
    tiers: [
      {
        name: "Open Source",
        price: "Free",
        description: "Reverse proxy, LB, SSL termination, caching",
      },
      {
        name: "NGINX Plus",
        price: "~$2,500/yr per instance",
        description:
          "Session persistence, active health checks, live monitoring, dynamic config API",
      },
      {
        name: "App Protect WAF",
        price: "~$2,000/instance/yr additional",
        description: "WAF add-on for NGINX Plus",
      },
    ],
  },

  Envoy: {
    model: "Open source (free, Apache 2.0). Commercial support from Tetrate.",
    unit: "Annual subscription for Tetrate Enterprise Envoy Gateway.",
    tiers: [
      {
        name: "Open Source",
        price: "Free",
        description: "CNCF project, used as data plane for Istio/App Mesh",
      },
      {
        name: "Tetrate Enterprise",
        price: "~$5,000–$70,000/yr",
        description: "CVE management, FIPS builds, OIDC, expert support",
      },
    ],
  },

  Traefik: {
    model: "Open source (free, MIT license) or Traefik Enterprise annual subscription.",
    unit: "Per instance/year for Enterprise.",
    tiers: [
      {
        name: "Open Source",
        price: "Free",
        description: "HTTP/TCP/UDP routing, Let's Encrypt, K8s Ingress, Docker",
      },
      {
        name: "Enterprise",
        price: "~$2,000/instance/yr",
        description: "Distributed rate limiting, SSO/OIDC, HA Raft consensus, 24/7 support",
      },
    ],
  },

  Apigee: {
    model: "Pay-as-you-go (per API call + environment hourly) or annual subscription tiers.",
    unit: "API proxy calls. Standard proxies cost 1/5 of Extensible proxies. Environment type affects hourly base cost.",
    tiers: [
      {
        name: "Standard Proxy (PAYG)",
        price: "$20/million calls",
        description: "First 50M; lighter policies",
      },
      {
        name: "Extensible Proxy (PAYG)",
        price: "$100/million calls",
        description: "First 50M; full policy set (5x standard)",
      },
      { name: "Base Environment", price: "$0.50/hr", description: "20 proxy units included" },
      {
        name: "Comprehensive Environment",
        price: "$4.70/hr",
        description: "100 proxy units included",
      },
      {
        name: "Subscription Enterprise",
        price: "~$1,460/month",
        description: "7.5B calls/year included",
      },
    ],
    freeTier: "60-day evaluation tier with full platform access",
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

  // ─── LOAD BALANCERS ───────────────────────────────────────────────────────────

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

  HAProxy: {
    model: "Open source (free). HAProxy Cloud for managed deployments.",
    unit: "Free for self-hosted. Managed service pricing via HAProxy Cloud.",
    tiers: [
      { name: "Community Edition", price: "Free", description: "Open source, self-hosted" },
      {
        name: "HAProxy Enterprise",
        price: "Contact sales",
        description: "Commercial support, advanced features",
      },
    ],
  },

  // ─── CDN ──────────────────────────────────────────────────────────────────────

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

  "AWS CloudFront": {
    model: "Pay-as-you-go per GB egress + per request. Or flat-rate monthly plans.",
    unit: "Per GB data transfer out to internet + per 10,000 requests. Rates vary by geographic region.",
    tiers: [
      {
        name: "US/EU Egress (first 10 TB)",
        price: "$0.085/GB",
        description: "North America, Europe",
      },
      { name: "Asia Pacific Egress", price: "$0.120/GB", description: "HK, SG, JP, KR, TW, etc." },
      { name: "HTTPS Requests", price: "$0.01 per 10,000", description: "US/Europe" },
      {
        name: "Flat-Rate Pro",
        price: "$15/month",
        description: "50 TB transfer + 10M requests included",
      },
      { name: "Origin Shield", price: "~$0.009/GB", description: "Optional: reduces origin load" },
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

  Fastly: {
    model:
      "Usage-based per GB bandwidth + per request. $50/month minimum, or committed packages from $1,500/month.",
    unit: "Per GB delivered + per 10,000 requests. Rates vary by region.",
    tiers: [
      { name: "US/EU Bandwidth", price: "$0.12/GB", description: "First 10 TB/month" },
      { name: "Asia/LATAM", price: "$0.19–$0.28/GB", description: "2–3x North America rates" },
      { name: "Requests (US/EU)", price: "$0.0075 per 10,000", description: "Per HTTP request" },
      {
        name: "Growth (committed)",
        price: "From $1,500/month",
        description: "Better per-GB rates, priority support, SLA",
      },
    ],
    freeTier: "$50/month recurring credit (perpetual low-volume free tier for small workloads)",
  },

  Akamai: {
    model:
      "Contract-based only. No published public pricing. Minimum 12-month contracts, typically $5,000–$15,000+/month.",
    unit: "Negotiated per-GB rates based on committed monthly bandwidth volume and geographic mix.",
    tiers: [
      { name: "US/EU (0–10 TB)", price: "~$0.049/GB", description: "Indicative, not official" },
      {
        name: "US/EU (>50 TB)",
        price: "Negotiated (<$0.01/GB possible)",
        description: "Large customers with 100s of TB/month",
      },
      { name: "APAC/LATAM", price: "30–60% more than US", description: "Higher regional rates" },
    ],
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

  "Vercel Edge Network": {
    model:
      "Bundled into Vercel platform plans. No separate CDN line item. Overages at per-GB rate.",
    unit: "Plan-based with overage charges on data transfer and edge requests.",
    tiers: [
      {
        name: "Hobby (Free)",
        price: "$0/month",
        description: "100 GB transfer + 1M edge requests",
      },
      { name: "Pro", price: "$20/seat/month", description: "1 TB transfer + 10M edge requests" },
      {
        name: "Bandwidth Overage",
        price: "$0.15/GB",
        description: "Above plan limits (higher than raw CloudFront)",
      },
      {
        name: "Edge Request Overage",
        price: "$2.00/million",
        description: "Above 10M/month on Pro",
      },
    ],
    freeTier: "100 GB transfer + 1M edge requests/month (Hobby, personal projects only)",
  },

  // ─── CACHES ───────────────────────────────────────────────────────────────────

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
        description: "Redis OSS EOL 2026; additional 80% on base node price for extended support",
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

  Dragonfly: {
    model: "Per-GB of provisioned memory per month. Three performance tiers.",
    unit: "GB of memory/month. Multi-threaded Redis/Memcached-compatible.",
    tiers: [
      { name: "Standard", price: "~$8/GB/month", description: "Base performance tier" },
      { name: "Enhanced", price: "~$11/GB/month", description: "Better latency" },
      { name: "Extreme", price: "Higher (varies)", description: "GPU-class latency" },
      { name: "Backup Storage", price: "$0.10/GB/month", description: "Prorated hourly" },
    ],
    freeTier: "Community edition (self-hosted) free. $100 trial credits for cloud.",
    modes: [
      {
        name: "Annual Commitment",
        priceImpact: "Up to 20% off",
        description: "vs flex/on-demand pricing",
      },
    ],
  },

  KeyDB: {
    model: "Open source, self-hosted only. No managed cloud service.",
    unit: "Free (self-hosted infrastructure costs only).",
    tiers: [
      { name: "Open Source", price: "Free", description: "Multi-threaded Redis fork, self-hosted" },
    ],
  },

  Hazelcast: {
    model: "Per-GB of provisioned memory per hour.",
    unit: "GB-hour. $0.10/GB/hour for all non-free clusters.",
    tiers: [
      { name: "Standard", price: "$0.10/GB/hr", description: "10 GB = $1/hr = ~$720/month" },
      { name: "Dedicated", price: "Custom", description: "Contact sales for private pricing" },
    ],
    freeTier: "Free development cluster available",
  },

  Varnish: {
    model: "Open source (free). Fastly is built on Varnish.",
    unit: "Free (self-hosted). Fastly pricing applies for managed Varnish-based CDN.",
    tiers: [{ name: "Open Source", price: "Free", description: "HTTP accelerator, self-hosted" }],
  },

  "CDN Edge Cache": {
    model: "Varies by provider — see Cloudflare CDN, AWS CloudFront, and Fastly entries.",
    unit: "Per GB egress or flat plan depending on provider.",
    tiers: [
      { name: "Cloudflare", price: "$0 (unlimited)", description: "Flat plan, no per-GB charge" },
      { name: "CloudFront", price: "$0.085/GB (US/EU)", description: "Pay per GB" },
      { name: "Fastly", price: "$0.12/GB (US/EU)", description: "Pay per GB + per request" },
    ],
  },

  // ─── MESSAGE QUEUES ───────────────────────────────────────────────────────────

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
        description: "Strict ordering within Message Group ID + dedup within 5-min window",
      },
      {
        name: "FIFO Throughput Limit",
        priceImpact: "Capped at 3,000 msg/sec with batching",
        description: "300 msg/sec without batching vs unlimited for Standard",
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

  // ─── STORAGE ──────────────────────────────────────────────────────────────────

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
      { name: "Egress (first 10 TB)", price: "$0.09/GB", description: "S3 → CloudFront is free" },
    ],
    freeTier: "5 GB Standard + 20K GET + 2K PUT + 100 GB egress/month (12 months)",
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

  MinIO: {
    model:
      "Open source (AGPLv3) — free self-hosted. Commercial AIStor subscription per committed TiB.",
    unit: "Per committed usable TiB for AIStor. Free for community edition (self-hosted infrastructure costs only).",
    tiers: [
      {
        name: "Community (Open Source)",
        price: "Free",
        description: "AGPLv3, S3-compatible, build from source or Docker",
      },
      {
        name: "AIStor Enterprise",
        price: "~$96,000/yr (up to 400 TiB)",
        description: "FIPS, SOC 2, ISO 27001, 24/7 support",
      },
    ],
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

  Ceph: {
    model: "Open source (LGPL 2.1) — free. IBM Storage Ceph subscription per TB.",
    unit: "Per TB of raw storage capacity for IBM commercial offering.",
    tiers: [
      {
        name: "Community (Open Source)",
        price: "Free",
        description: "Block (RBD) + File (CephFS) + Object (RGW), self-hosted",
      },
      {
        name: "IBM Storage Ceph",
        price: "~$26/TB-month",
        description: "Starting rate; includes software + optional RHEL",
      },
    ],
  },

  // ─── FIREWALLS & SECURITY ─────────────────────────────────────────────────────

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

  "Palo Alto Networks": {
    model:
      "Credit-based (1–5 year pre-purchase) or PAYG from AWS/Azure Marketplace. Hourly rate + per-GB traffic + security service add-ons.",
    unit: "Hourly NGFW resource rate + tiered per-GB traffic charge. Credits are multi-cloud fungible.",
    tiers: [
      {
        name: "PAYG (AWS)",
        price: "Custom per-hour + per-GB",
        description: "On-demand from Marketplace",
      },
      {
        name: "Credit-Based (1–3yr)",
        price: "Discounted pre-purchase",
        description: "Credits consumed by usage; overages at PAYG rates",
      },
    ],
    freeTier: "30-day free trial on AWS Marketplace",
  },

  ModSecurity: {
    model: "Open source (free). Self-hosted as module in Nginx/Apache.",
    unit: "Free. Infrastructure costs only.",
    tiers: [
      {
        name: "Open Source",
        price: "Free",
        description: "WAF engine with OWASP Core Rule Set, runs in Nginx/Apache",
      },
    ],
  },

  // ─── DNS ──────────────────────────────────────────────────────────────────────

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
      { name: "Latency-Based Routing", price: "$0.60/million", description: "First 1B/month" },
      { name: "Geolocation Queries", price: "$0.70/million", description: "First 1B/month" },
      {
        name: "Alias Records",
        price: "Free",
        description: "Queries to AWS services (ELB, CloudFront, S3)",
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

  "Azure DNS": {
    model: "Per DNS zone/month + per million queries.",
    unit: "Zones/month + queries/million. Nearly identical to Route 53 pricing.",
    tiers: [
      { name: "Zone (first 25)", price: "$0.50/zone/month", description: "Same as Route 53" },
      { name: "Queries", price: "$0.40/million", description: "First 1B/month" },
    ],
  },

  "NS1 (IBM)": {
    model:
      "Annual subscription bundles with fixed query quota, records, and monitors. Overage per unit above limits.",
    unit: "Monthly plan with query/month quota. Overage: ~$50/million excess queries.",
    tiers: [
      { name: "Essentials", price: "$99/month", description: "30M queries/month, 1,000 records" },
      {
        name: "Essentials Large",
        price: "$349/month",
        description: "80M queries/month, 1,000 records",
      },
      {
        name: "Standard-150",
        price: "$786/month",
        description: "150M queries, 3 filter chains, 7 monitors",
      },
      {
        name: "Standard-1000",
        price: "$3,879/month",
        description: "1B queries, 10K records, 100 monitors",
      },
    ],
    freeTier: "Developer plan with limited scale, full API access",
  },

  CoreDNS: {
    model: "Open source, free. Kubernetes default cluster DNS.",
    unit: "Free (self-hosted infrastructure costs only).",
    tiers: [
      { name: "Open Source", price: "Free", description: "Plugin-based DNS server, K8s built-in" },
    ],
  },

  // ─── SERVERLESS ───────────────────────────────────────────────────────────────

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

  "Vercel Functions": {
    model: "Plan-based with usage limits and overage. Not pure pay-per-invocation.",
    unit: "CPU-hours + GB-hours + invocations, with plan-based included allocations.",
    tiers: [
      {
        name: "Hobby (Free)",
        price: "$0/month",
        description: "60s timeout, 100 GB bandwidth, 1M edge requests",
      },
      {
        name: "Pro",
        price: "$20/seat/month",
        description: "1 TB bandwidth, 10M edge requests, $20 usage credit",
      },
      {
        name: "Serverless Compute Overage",
        price: "$0.128/CPU-hr",
        description: "Above included allocation",
      },
      { name: "Memory Overage", price: "$0.0106/GB-hr", description: "Above included allocation" },
      { name: "Invocation Overage", price: "$0.60/million", description: "Above plan limits" },
    ],
    freeTier: "Hobby plan: free for personal/non-commercial projects",
  },

  "AWS Fargate": {
    model:
      "Per vCPU-hour + per GB-hour, billed per second (1-min minimum). Serverless containers for ECS/EKS.",
    unit: "vCPU-hour + GB-hour. Pricing starts when container images are pulled.",
    tiers: [
      { name: "vCPU (Linux x86)", price: "$0.04048/hr", description: "~$29.55/month per vCPU" },
      { name: "Memory (Linux x86)", price: "$0.004445/GB-hr", description: "~$3.24/month per GB" },
      { name: "vCPU (ARM/Graviton)", price: "$0.03239/hr", description: "~20% cheaper than x86" },
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

  // ─── CONTAINERS ───────────────────────────────────────────────────────────────

  "Kubernetes (K8s)": {
    model:
      "Control plane fee + worker node compute. EKS: $0.10/cluster/hr + EC2. GKE: $0.10/cluster/hr + GCE (one free cluster per account). AKS: $0 (free tier) or $0.10/cluster/hr.",
    unit: "Cluster management fee/hour + underlying VM costs. Worker node cost dominates total.",
    tiers: [
      {
        name: "EKS Control Plane",
        price: "$0.10/cluster/hr (~$73/mo)",
        description: "Extended support: $0.60/hr",
      },
      {
        name: "GKE Control Plane",
        price: "$0.10/cluster/hr",
        description: "$74.40/mo credit = ~1 free cluster",
      },
      {
        name: "AKS Free Tier",
        price: "$0/cluster/hr",
        description: "No SLA; Standard: $0.10/hr with 99.95% SLA",
      },
      {
        name: "EC2 m6i.large (GP)",
        price: "$0.096/hr",
        description: "2 vCPU, 8 GB — general purpose worker",
      },
      {
        name: "EC2 c6i.large (Compute)",
        price: "$0.085/hr",
        description: "2 vCPU, 4 GB — CPU-optimized",
      },
      {
        name: "EC2 r6i.large (Memory)",
        price: "$0.126/hr",
        description: "2 vCPU, 16 GB — memory-optimized",
      },
      { name: "EC2 m7g.large (ARM)", price: "~$0.077/hr", description: "~20% cheaper, Graviton3" },
      {
        name: "GKE Autopilot (CPU)",
        price: "$0.0445/vCPU-hr",
        description: "Per-pod billing, no node management",
      },
      { name: "GKE Autopilot (Memory)", price: "$0.0049/GiB-hr", description: "Per-pod billing" },
    ],
    modes: [
      {
        name: "Spot/Preemptible Instances",
        priceImpact: "Up to 90% off",
        description: "Interruptible; best for stateless, fault-tolerant workloads",
      },
      {
        name: "Reserved Instances (3yr)",
        priceImpact: "~60% savings",
        description: "All Upfront 3-year commitment on EC2 nodes",
      },
      {
        name: "Savings Plans",
        priceImpact: "~66% savings",
        description: "3-year All Upfront Compute Savings Plan",
      },
    ],
  },

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
      { name: "Fargate (1 vCPU + 2 GB)", price: "~$36/month", description: "On-demand, 24/7" },
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
        description: "Fargate: no management overhead. EC2: cheaper with RIs at high utilization.",
      },
    ],
  },

  "Docker Swarm": {
    model: "Open source, free. Self-hosted infrastructure costs only.",
    unit: "Free (self-hosted).",
    tiers: [
      {
        name: "Open Source",
        price: "Free",
        description: "Docker-native orchestration, simpler than K8s",
      },
    ],
  },

  "Nomad (HashiCorp)": {
    model:
      "Open source free. Enterprise: licensed per cluster (contact sales). HCP Nomad: managed, pricing not public.",
    unit: "Per cluster license (Enterprise) + underlying infrastructure costs.",
    tiers: [
      { name: "Open Source", price: "Free", description: "No licensing cost, self-hosted" },
      {
        name: "Enterprise",
        price: "Contact sales",
        description: "Governance, multi-region federation, audit logging",
      },
      { name: "HCP Nomad", price: "Contact sales", description: "Managed by HashiCorp/IBM" },
    ],
  },

  "Red Hat OpenShift": {
    model:
      "ROSA (AWS): $0.25/cluster/hr + $0.171/4 vCPUs/hr worker fee + EC2 infrastructure costs.",
    unit: "Cluster-hour + worker node service fee per 4 vCPUs + underlying EC2 costs.",
    tiers: [
      {
        name: "ROSA HCP Cluster Fee",
        price: "$0.25/cluster/hr (~$182/mo)",
        description: "Hosted control plane",
      },
      {
        name: "Worker Node Fee",
        price: "$0.171/hr per 4 vCPUs",
        description: "Red Hat subscription layer on EC2",
      },
      {
        name: "Minimum Viable Cluster",
        price: "~$1,400+/month",
        description: "3 workers + 3 infra nodes (m5.xlarge) + cluster fee",
      },
    ],
    modes: [
      {
        name: "1-Year Commit",
        priceImpact: "~33% savings on worker fee",
        description: "$0.115/hr per 4 vCPUs",
      },
      {
        name: "3-Year Commit",
        priceImpact: "~55% savings on worker fee",
        description: "$0.077/hr per 4 vCPUs",
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

  // ─── STREAM PROCESSORS ────────────────────────────────────────────────────────

  "Apache Kafka Streams": {
    model:
      "Library (no separate service cost). Runs on your compute. Confluent Cloud ksqlDB pricing applies if using managed stream processing.",
    unit: "No separate charge — runs on your Kafka consumer infrastructure (EC2/K8s/etc).",
    tiers: [
      { name: "Open Source Library", price: "Free", description: "Runs in your JVM application" },
      {
        name: "Confluent ksqlDB",
        price: "Included in Confluent Cloud cluster costs",
        description: "CSU-based for managed stream processing",
      },
    ],
  },

  "Apache Flink": {
    model: "AWS Managed Service: per KPU-hour. Confluent: included in cluster pricing.",
    unit: "KPU (Kinesis Processing Unit). 1 KPU = 1 vCPU + 4 GB RAM. +1 KPU overhead for orchestration.",
    tiers: [
      { name: "KPU Compute", price: "$0.11/KPU-hr", description: "1 vCPU + 4 GB RAM per KPU" },
      {
        name: "Running App Storage",
        price: "$0.10/GB-month",
        description: "50 GB allocated per KPU",
      },
      {
        name: "Durable Backups",
        price: "$0.10/GB-month",
        description: "Checkpoint/savepoint storage",
      },
    ],
  },

  "Apache Spark Streaming": {
    model: "Databricks: DBU-based. AWS EMR: EC2 + EMR surcharge. No separate streaming charge.",
    unit: "DBU (Databricks Unit) per hour on Databricks. Or instance-hour + EMR surcharge on EMR.",
    tiers: [
      {
        name: "Databricks Jobs Compute",
        price: "~$0.15/DBU-hr",
        description: "Standard streaming jobs on AWS Premium",
      },
      {
        name: "Databricks DLT",
        price: "~$0.20–$0.25/DBU-hr",
        description: "Delta Live Tables (managed ETL)",
      },
      {
        name: "EMR Surcharge",
        price: "$0.015–$0.27/instance-hr",
        description: "On top of EC2 on-demand rates",
      },
    ],
  },

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
      { name: "Vended Logs", price: "$0.13/GB", description: "CloudWatch, VPC Flow Logs, etc." },
      { name: "Format Conversion", price: "$0.018/GB", description: "JSON → Parquet/ORC" },
      { name: "Snowflake Destination", price: "$0.071/GB", description: "Direct to Snowflake" },
    ],
  },

  RisingWave: {
    model: "Per RWU-hour (RisingWave Unit) + storage + data transfer.",
    unit: "RWU = MAX(1 vCPU, 4 GB memory). Billed on whichever resource (compute or memory) is the binding constraint.",
    tiers: [
      { name: "Basic Compute", price: "$0.227/RWU-hr", description: "Up to 64 cores" },
      { name: "Storage", price: "$0.0299/GB-month", description: "Materialized view storage" },
      { name: "Public Egress", price: "$0.17/GB", description: "Public network data out" },
      { name: "Pro", price: "Custom", description: "Unlimited cores, PAYG or annual" },
    ],
    freeTier: "7-day free trial on Basic plan",
  },

  // ─── DATA WAREHOUSES ──────────────────────────────────────────────────────────

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

  "Amazon Redshift": {
    model: "Provisioned: per node-hour (DC2 or RA3 types). Serverless: per RPU-hour.",
    unit: "Node-hour (Provisioned) or RPU-hour (Serverless). RPU = Redshift Processing Unit, configurable from 4 to 1024.",
    tiers: [
      {
        name: "dc2.large (Provisioned)",
        price: "$0.25/node-hr",
        description: "Compute-dense, fixed local SSD",
      },
      {
        name: "ra3.xlplus (Provisioned)",
        price: "~$1.086/node-hr",
        description: "Separate compute + Managed Storage",
      },
      {
        name: "RA3 Managed Storage",
        price: "$0.024/GB-month",
        description: "Auto-tiered SSD + S3",
      },
      {
        name: "Serverless RPU",
        price: "~$0.375/RPU-hr",
        description: "Min 4 RPUs = $1.50/hr when active; $0 when idle",
      },
    ],
    freeTier: "$300 credit for Redshift Serverless (90-day trial)",
    modes: [
      {
        name: "Reserved Instances (3yr)",
        priceImpact: "Up to 75–76% savings",
        description: "All Upfront 3-year commitment on provisioned nodes",
      },
      {
        name: "Serverless Reservations",
        priceImpact: "Up to 45% savings",
        description: "Commit to RPU-hours",
      },
      {
        name: "Concurrency Scaling",
        priceImpact: "1 free hour/day; then on-demand per-second",
        description: "Extra compute for query bursts",
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

  // ─── WEBHOOKS ─────────────────────────────────────────────────────────────────

  Svix: {
    model: "Plan-based with per-message overage. Only attempted messages count — retries are free.",
    unit: "Messages/month. 1 message = 1 webhook delivery attempt.",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        description: "50K messages, 50 msg/sec, 30-day retention",
      },
      {
        name: "Professional",
        price: "$490/month",
        description: "50K included, $0.0001/msg overage, 400 msg/sec",
      },
      { name: "Enterprise", price: "Custom", description: "On-premises, VPC peering, 99.999% SLA" },
    ],
    freeTier: "50,000 messages/month, 99.9% SLA",
  },

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
      { name: "Scheduler", price: "$1.00/million invocations", description: "14M/month free" },
    ],
    freeTier: "EventBridge Scheduler: 14M invocations/month permanently free",
  },

  Hookdeck: {
    model: "Plan-based with per-event overage. Retries included at no extra cost.",
    unit: "Events/month. 1 event = 1 inbound webhook delivery attempt.",
    tiers: [
      { name: "Developer", price: "$0/month", description: "10K events, 3-day retention, 1 user" },
      { name: "Team", price: "$39/month", description: "10K included + $0.33/100K overage" },
      {
        name: "Growth",
        price: "$499/month",
        description: "10K included + overage, 30-day retention, SLA",
      },
    ],
    freeTier: "10,000 events/month, 3-day retention",
  },

  "Zapier Webhooks": {
    model:
      "Included in Zapier plan (per-task pricing). Webhooks are a trigger/action type within Zaps.",
    unit: "Zapier tasks/month. Webhook triggers consume tasks like any other Zap step.",
    tiers: [
      { name: "Free", price: "$0/month", description: "100 tasks/month" },
      { name: "Professional", price: "$29.99/month", description: "750 tasks/month" },
    ],
  },

  ngrok: {
    model: "Plan-based with usage limits and overages on data transfer and HTTP requests.",
    unit: "Data transfer (GB) + HTTP requests (per 100K).",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        description: "3 endpoints, 1 GB one-time credit, 20K requests/month",
      },
      {
        name: "Pay-as-You-Go",
        price: "$20/month",
        description: "Unlimited endpoints, 5 GB included, $0.10/GB overage",
      },
      {
        name: "HTTP Request Overage",
        price: "$1/100K requests",
        description: "Above included allocation",
      },
    ],
    freeTier: "3 endpoints + 1 GB data + 20K requests/month",
  },

  "Custom (Express/FastAPI)": {
    model: "Self-hosted — cost depends on your compute infrastructure.",
    unit: "No direct service cost. Pay for your own servers/containers/serverless.",
    tiers: [
      {
        name: "Self-Hosted",
        price: "Infrastructure costs only",
        description: "No third-party webhook service fees",
      },
    ],
  },

  // ─── SCHEDULING ───────────────────────────────────────────────────────────────

  "AWS EventBridge Scheduler": {
    model: "Per invocation. Extremely economical with generous free tier.",
    unit: "Invocations (each scheduled rule firing).",
    tiers: [{ name: "Invocations", price: "$1.00/million", description: "After free tier" }],
    freeTier: "14,000,000 invocations/month — permanently free",
  },

  "GCP Cloud Scheduler": {
    model: "Per job definition (not per execution). A job's existence is billed, not its runs.",
    unit: "Jobs/month. Paused jobs still count.",
    tiers: [{ name: "Per Job", price: "$0.10/job/month", description: "Pro-rated daily" }],
    freeTier: "3 free jobs/month per billing account",
  },

  "Cron (Linux)": {
    model: "Free. Built into any Linux system.",
    unit: "No cost (standard Unix utility).",
    tiers: [{ name: "Built-in", price: "Free", description: "1-minute minimum granularity" }],
  },

  "Kubernetes CronJob": {
    model: "No additional cost. Uses existing cluster compute resources.",
    unit: "No separate charge — uses pod resources billed by your K8s infrastructure.",
    tiers: [
      {
        name: "Built-in",
        price: "Free (uses cluster resources)",
        description: "K8s-native, 1-minute granularity",
      },
    ],
  },

  "Celery Beat": {
    model: "Open source, free. Requires a broker (Redis/RabbitMQ).",
    unit: "Free (broker infrastructure costs only).",
    tiers: [{ name: "Open Source", price: "Free", description: "Python, requires broker" }],
  },

  Temporal: {
    model:
      "Per action + storage. Actions are billable operations between your app and Temporal Cloud.",
    unit: "Action — each meaningful state change counts: Workflow Started, Signal sent, Query executed, Heartbeat, Update (successful or rejected). NOT counted: timer creation, activity scheduling, continue-as-new.",
    tiers: [
      {
        name: "First 5M actions",
        price: "$50/million",
        description: "Decreasing tiers with volume",
      },
      { name: "50M–100M actions", price: "$30/million", description: "Volume discount" },
      { name: "100M–200M actions", price: "$25/million", description: "High-volume tier" },
      { name: "Active Storage", price: "$0.042/GB-hr", description: "Open/running workflows" },
      {
        name: "Retained Storage",
        price: "$0.00105/GB-hr",
        description: "Completed/closed workflows",
      },
      {
        name: "Essentials Plan",
        price: "$100/month minimum",
        description: "1M actions + 1 GB active + 40 GB retained included",
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

  // ─── SEARCH ENGINES ───────────────────────────────────────────────────────────

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
      { name: "UltraWarm Storage", price: "$0.024/GB-month", description: "S3-backed warm tier" },
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

  // ─── CLIENT FRAMEWORKS (mostly free/open-source) ──────────────────────────────

  React: {
    model: "Open source (MIT license). Hosting costs depend on provider.",
    unit: "Free. Hosting: Vercel from $0/mo, Netlify from $0/mo.",
    tiers: [{ name: "Library", price: "Free", description: "MIT license, client-side framework" }],
  },

  "Next.js": {
    model: "Open source (MIT). Vercel hosting: plan-based. Self-host on any Node.js platform.",
    unit: "Free framework. Vercel: $0 Hobby, $20/seat Pro.",
    tiers: [
      { name: "Framework", price: "Free", description: "MIT license" },
      {
        name: "Vercel Hobby",
        price: "$0/month",
        description: "100 GB bandwidth, personal projects",
      },
      {
        name: "Vercel Pro",
        price: "$20/seat/month",
        description: "1 TB bandwidth, production apps",
      },
    ],
  },

  "Vue.js": {
    model: "Open source (MIT license). Free.",
    unit: "Free.",
    tiers: [{ name: "Framework", price: "Free", description: "MIT license" }],
  },

  Angular: {
    model: "Open source (MIT license). Free.",
    unit: "Free.",
    tiers: [{ name: "Framework", price: "Free", description: "MIT license" }],
  },

  "React Native": {
    model: "Open source (MIT). App store fees: Apple $99/yr, Google $25 one-time.",
    unit: "Free framework. App store submission fees apply.",
    tiers: [
      { name: "Framework", price: "Free", description: "MIT license" },
      {
        name: "Expo (EAS)",
        price: "Free–$99/month",
        description: "Cloud build and submit service",
      },
    ],
  },

  Flutter: {
    model: "Open source (BSD). Free.",
    unit: "Free.",
    tiers: [{ name: "Framework", price: "Free", description: "BSD license" }],
  },

  "Swift/SwiftUI": {
    model: "Free. Apple Developer Program: $99/year for App Store distribution.",
    unit: "Free language/framework. $99/yr Apple developer account for distribution.",
    tiers: [
      { name: "Language/Framework", price: "Free", description: "Apache 2.0 license" },
      { name: "Apple Developer Program", price: "$99/year", description: "Required for App Store" },
    ],
  },

  "Kotlin/Jetpack Compose": {
    model: "Free. Google Play developer account: $25 one-time.",
    unit: "Free language/framework. $25 one-time for Google Play.",
    tiers: [
      { name: "Language/Framework", price: "Free", description: "Apache 2.0 license" },
      {
        name: "Google Play Developer",
        price: "$25 one-time",
        description: "Required for Play Store",
      },
    ],
  },

  // ─── SERVICE FRAMEWORKS (self-hosted, no direct service fees) ─────────────────

  "Node.js (Express/Fastify)": {
    model: "Open source, free. Hosting costs depend on compute infrastructure.",
    unit: "Free (infrastructure costs only).",
    tiers: [{ name: "Runtime/Frameworks", price: "Free", description: "MIT license" }],
  },

  "Go (net/http, Gin, Fiber)": {
    model: "Open source, free.",
    unit: "Free (infrastructure costs only).",
    tiers: [{ name: "Language/Frameworks", price: "Free", description: "BSD license" }],
  },

  "Java (Spring Boot)": {
    model: "Open source, free. Optional VMware Tanzu Spring commercial support.",
    unit: "Free (infrastructure costs only).",
    tiers: [
      { name: "Framework", price: "Free", description: "Apache 2.0 license" },
      {
        name: "Tanzu Spring (commercial)",
        price: "Contact VMware",
        description: "Enterprise support and runtime",
      },
    ],
  },

  "Python (FastAPI/Django)": {
    model: "Open source, free.",
    unit: "Free (infrastructure costs only).",
    tiers: [{ name: "Frameworks", price: "Free", description: "MIT/BSD licenses" }],
  },

  "Rust (Actix/Axum)": {
    model: "Open source, free.",
    unit: "Free (infrastructure costs only).",
    tiers: [{ name: "Language/Frameworks", price: "Free", description: "MIT/Apache 2.0 licenses" }],
  },

  ".NET (ASP.NET Core)": {
    model: "Open source, free. .NET runtime and SDK are MIT licensed.",
    unit: "Free (infrastructure costs only).",
    tiers: [{ name: "Framework", price: "Free", description: "MIT license" }],
  },

  "Elixir (Phoenix)": {
    model: "Open source, free.",
    unit: "Free (infrastructure costs only).",
    tiers: [{ name: "Framework", price: "Free", description: "MIT/Apache 2.0 licenses" }],
  },

  "gRPC Service": {
    model: "Open source, free.",
    unit: "Free (infrastructure costs only).",
    tiers: [{ name: "Framework", price: "Free", description: "Apache 2.0 license" }],
  },
};
