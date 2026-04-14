import type { Fetcher, FetchResult, TechnologyPricing } from "../types.ts";
import { log, toResult } from "../utils.ts";

// Open-source and free technologies — frameworks, libraries, self-hosted tools.
// No pricing to fetch; these are free/OSS with optional commercial support.

const STATIC: Record<string, TechnologyPricing> = {
  // ─── NETWORKING / INFRA (self-hosted) ───────────────────────────────────────

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

  // ─── CACHES ─────────────────────────────────────────────────────────────────

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

  // ─── STORAGE (self-hosted) ──────────────────────────────────────────────────

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

  // ─── SECURITY ───────────────────────────────────────────────────────────────

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

  // ─── DNS ────────────────────────────────────────────────────────────────────

  CoreDNS: {
    model: "Open source, free. Kubernetes default cluster DNS.",
    unit: "Free (self-hosted infrastructure costs only).",
    tiers: [
      { name: "Open Source", price: "Free", description: "Plugin-based DNS server, K8s built-in" },
    ],
  },

  // ─── STREAM PROCESSORS ──────────────────────────────────────────────────────

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

  // ─── CONTAINER ORCHESTRATION ────────────────────────────────────────────────

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

  // ─── DATABASES (self-hosted/embedded) ───────────────────────────────────────

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

  // ─── SCHEDULING ─────────────────────────────────────────────────────────────

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

  // ─── WEBHOOKS ───────────────────────────────────────────────────────────────

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

  // ─── CLIENT FRAMEWORKS ──────────────────────────────────────────────────────

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

  // ─── SERVICE FRAMEWORKS ─────────────────────────────────────────────────────

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

export const fetcher: Fetcher = {
  name: "open-source",
  description: "Open-source frameworks, libraries, and self-hosted tools (free)",
  technologies: Object.keys(STATIC),
  async fetch(): Promise<FetchResult[]> {
    log("Open-source: returning static reference data (all free/OSS)");
    return Object.entries(STATIC).map(([tech, pricing]) =>
      toResult(tech, pricing, "open-source"),
    );
  },
};
