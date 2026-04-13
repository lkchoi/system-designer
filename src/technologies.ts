import type { ComponentType, TechnologyInfo } from "./types";

// ---------------------------------------------------------------------------
// Shared technology bases – cross-cutting techs whose name + providers are
// defined once and referenced from multiple categories.
// ---------------------------------------------------------------------------

interface TechBase {
  name: string;
  providers: string[];
}

const SHARED: Record<string, TechBase> = {
  redis: {
    name: "Redis",
    providers: ["AWS ElastiCache", "GCP Memorystore", "Azure Cache", "Redis Cloud", "Upstash"],
  },
  kafka: {
    name: "Apache Kafka",
    providers: ["Confluent Cloud", "AWS MSK", "Azure Event Hubs", "Aiven"],
  },
  nginx: {
    name: "Nginx",
    providers: ["Self-hosted", "F5 Cloud", "AWS Marketplace"],
  },
  envoy: {
    name: "Envoy",
    providers: ["Self-hosted", "Tetrate", "AWS App Mesh"],
  },
  eventbridge: {
    name: "AWS EventBridge",
    providers: ["AWS"],
  },
  flink: {
    name: "Apache Flink",
    providers: ["AWS Kinesis Data Analytics", "Confluent", "Ververica"],
  },
};

// ---------------------------------------------------------------------------
// Catalog entry types
// ---------------------------------------------------------------------------

type SharedRef = {
  ref: string;
  throughput: string;
  limits: string;
  purpose: string;
};

type Standalone = {
  id: string;
  name: string;
  providers: string[];
  throughput: string;
  limits: string;
  purpose: string;
};

type CatalogEntry = SharedRef | Standalone;

// ---------------------------------------------------------------------------
// Resolver – expands a SharedRef into a full TechnologyInfo
// ---------------------------------------------------------------------------

function resolve(entry: CatalogEntry): TechnologyInfo {
  if ("ref" in entry) {
    const base = SHARED[entry.ref];
    return {
      id: entry.ref,
      name: base.name,
      providers: base.providers,
      throughput: entry.throughput,
      limits: entry.limits,
      purpose: entry.purpose,
    };
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Raw catalog – per-category entries (shared refs + standalone)
// ---------------------------------------------------------------------------

const RAW_CATALOG: Record<ComponentType, CatalogEntry[]> = {
  database: [
    {
      id: "postgresql",
      name: "PostgreSQL",
      throughput: "10K-50K TPS (single node)",
      limits: "32 TB max DB size, 1600 max connections default",
      purpose: "General-purpose OLTP relational database with strong ACID compliance",
      providers: ["AWS RDS", "GCP Cloud SQL", "Azure Database", "Neon", "Supabase"],
    },
    {
      id: "mysql",
      name: "MySQL",
      throughput: "10K-40K TPS (single node)",
      limits: "256 TB max table size (InnoDB), 151 max connections default",
      purpose: "Widely deployed relational database, strong read performance",
      providers: ["AWS RDS", "GCP Cloud SQL", "Azure Database", "PlanetScale"],
    },
    {
      id: "mongodb",
      name: "MongoDB",
      throughput: "25K-100K ops/sec (single node)",
      limits: "16 MB max document size, no max DB size",
      purpose: "Document database for flexible schemas and rapid iteration",
      providers: ["MongoDB Atlas", "AWS DocumentDB", "Azure Cosmos DB"],
    },
    {
      id: "dynamodb",
      name: "DynamoDB",
      throughput: "Unlimited with auto-scaling, single-digit ms latency",
      limits: "400 KB max item size, 10 GB per partition",
      purpose: "Fully managed serverless key-value and document database",
      providers: ["AWS"],
    },
    {
      id: "cassandra",
      name: "Cassandra",
      throughput: "50K-200K writes/sec per node",
      limits: "2 GB max partition recommended, 2 billion cells per partition",
      purpose: "Wide-column store optimized for high write throughput and linear scalability",
      providers: ["AWS Keyspaces", "DataStax Astra", "Azure Managed Instance"],
    },
    {
      id: "cockroachdb",
      name: "CockroachDB",
      throughput: "10K-30K TPS per node",
      limits: "No max DB size, 64 MiB max SQL statement size",
      purpose: "Distributed SQL database with serializable isolation and automatic sharding",
      providers: ["CockroachDB Cloud", "AWS Marketplace", "GCP Marketplace"],
    },
    {
      id: "sql-server",
      name: "SQL Server",
      throughput: "10K-50K TPS",
      limits: "524 PB max DB size, 32767 max connections",
      purpose: "Enterprise relational database with deep BI and analytics integration",
      providers: ["Azure SQL", "AWS RDS", "GCP Cloud SQL"],
    },
    {
      id: "oracle",
      name: "Oracle Database",
      throughput: "50K-200K TPS with RAC",
      limits: "128 TB max datafile, 65535 max sessions",
      purpose: "Enterprise-grade RDBMS for mission-critical OLTP and mixed workloads",
      providers: ["Oracle Cloud", "AWS RDS", "Azure"],
    },
    {
      id: "tidb",
      name: "TiDB",
      throughput: "10K-100K TPS",
      limits: "No max size, MySQL compatible",
      purpose: "Distributed NewSQL database combining OLTP and OLAP (HTAP)",
      providers: ["TiDB Cloud", "AWS Marketplace", "GCP Marketplace"],
    },
    {
      id: "scylladb",
      name: "ScyllaDB",
      throughput: "100K-1M ops/sec per node",
      limits: "Cassandra-compatible, no hard partition size limit",
      purpose: "High-performance wide-column store, drop-in Cassandra replacement in C++",
      providers: ["ScyllaDB Cloud", "AWS Marketplace"],
    },
    {
      id: "mariadb",
      name: "MariaDB",
      throughput: "10K-40K TPS (single node)",
      limits: "256 TB max table size (InnoDB), configurable max connections",
      purpose: "Community-driven MySQL fork with enhanced storage engines and features",
      providers: ["AWS RDS", "Azure Database", "SkySQL", "Self-hosted"],
    },
    {
      id: "aurora",
      name: "Amazon Aurora",
      throughput: "5x MySQL / 3x PostgreSQL throughput",
      limits: "128 TB max storage, 5000 max connections (varies by instance)",
      purpose: "AWS-managed MySQL/PostgreSQL-compatible database with auto-scaling storage",
      providers: ["AWS"],
    },
    {
      id: "sqlite",
      name: "SQLite",
      throughput: "50K-100K+ TPS (single-writer, local disk)",
      limits: "281 TB max DB size, single-writer concurrency, no network access",
      purpose: "Embedded serverless database for local storage, mobile apps, and edge computing",
      providers: ["Embedded (in-process)", "Turso (distributed)", "Cloudflare D1"],
    },
    {
      id: "neo4j",
      name: "Neo4j",
      throughput: "10K-100K traversals/sec",
      limits: "34 billion nodes, 34 billion relationships per database",
      purpose: "Native graph database for connected data, knowledge graphs, and recommendations",
      providers: ["Neo4j Aura", "AWS Marketplace", "GCP Marketplace"],
    },
    {
      id: "cosmos-db",
      name: "Azure Cosmos DB",
      throughput: "Unlimited with auto-scaling, single-digit ms latency globally",
      limits: "2 MB max document size, 20 GB per logical partition",
      purpose: "Globally distributed multi-model database with turnkey geo-replication",
      providers: ["Azure"],
    },
    {
      id: "influxdb",
      name: "InfluxDB",
      throughput: "500K+ points/sec writes per node",
      limits: "1 MB max line protocol payload, configurable retention",
      purpose: "Purpose-built time-series database for metrics, events, and IoT data",
      providers: ["InfluxDB Cloud", "AWS Marketplace", "Self-hosted"],
    },
    {
      id: "firestore",
      name: "Google Cloud Firestore",
      throughput: "10K writes/sec per database, auto-scaling reads",
      limits: "1 MB max document size, 1 MiB max field value, 40K indexes per database",
      purpose: "Serverless document database with real-time sync for mobile and web apps",
      providers: ["GCP", "Firebase"],
    },
    {
      id: "couchbase",
      name: "Couchbase",
      throughput: "100K+ ops/sec per node",
      limits: "20 MB max document size, configurable memory quota",
      purpose: "Distributed multi-model database with built-in cache, full-text search, and SQL++",
      providers: ["Couchbase Capella", "AWS Marketplace", "Azure Marketplace"],
    },
  ],

  "api-gateway": [
    {
      ref: "nginx",
      throughput: "100K+ req/sec",
      limits: "1 MB default client body, configurable",
      purpose: "High-performance reverse proxy and API gateway",
    },
    {
      ref: "envoy",
      throughput: "100K+ req/sec per instance",
      limits: "Configurable, no hard limits",
      purpose: "Cloud-native edge and service proxy with advanced observability",
    },
    {
      id: "kong",
      name: "Kong",
      throughput: "50K-100K req/sec per node",
      limits: "No hard limit, depends on plugins",
      purpose: "Open-source API gateway with extensive plugin ecosystem",
      providers: ["Kong Cloud", "AWS Marketplace", "Self-hosted"],
    },
    {
      id: "aws-api-gateway",
      name: "AWS API Gateway",
      throughput: "10K req/sec default (adjustable)",
      limits: "10 MB payload, 29 sec timeout, 10K RPS soft limit",
      purpose: "Fully managed API gateway with native AWS integration",
      providers: ["AWS"],
    },
    {
      id: "traefik",
      name: "Traefik",
      throughput: "30K-80K req/sec",
      limits: "No hard limits, configurable",
      purpose: "Cloud-native reverse proxy with automatic service discovery",
      providers: ["Traefik Cloud", "Self-hosted"],
    },
    {
      id: "apigee",
      name: "Apigee",
      throughput: "10K+ TPS",
      limits: "10 MB payload, quotas configurable",
      purpose: "Enterprise API management platform with analytics and monetization",
      providers: ["GCP"],
    },
    {
      id: "azure-api-mgmt",
      name: "Azure API Management",
      throughput: "4K-40K req/sec depending on tier",
      limits: "Varies by tier, 2 MB-6.5 MB request body",
      purpose: "Full-lifecycle API management with developer portal",
      providers: ["Azure"],
    },
    {
      id: "cloudflare-api-gw",
      name: "Cloudflare API Gateway",
      throughput: "Millions of req/sec at edge",
      limits: "100 MB request body, configurable rate limits",
      purpose: "Edge-native API gateway with built-in DDoS protection",
      providers: ["Cloudflare"],
    },
  ],

  service: [
    {
      id: "nodejs",
      name: "Node.js (Express/Fastify)",
      throughput: "10K-50K req/sec",
      limits: "1.7 GB heap default (V8), event loop single-threaded",
      purpose: "JavaScript runtime for I/O-intensive microservices",
      providers: ["Any cloud/container platform"],
    },
    {
      id: "go",
      name: "Go (net/http, Gin, Fiber)",
      throughput: "50K-200K req/sec",
      limits: "No hard limits, goroutine-based concurrency",
      purpose: "Compiled language with goroutines for high-concurrency services",
      providers: ["Any cloud/container platform"],
    },
    {
      id: "java-spring",
      name: "Java (Spring Boot)",
      throughput: "10K-80K req/sec",
      limits: "JVM heap configurable, thread-pool based",
      purpose: "Enterprise-grade framework with vast ecosystem and mature tooling",
      providers: ["Any cloud/container platform"],
    },
    {
      id: "python-fastapi",
      name: "Python (FastAPI/Django)",
      throughput: "3K-15K req/sec (FastAPI with uvicorn)",
      limits: "GIL limits CPU-bound concurrency, configurable workers",
      purpose: "Rapid development with strong data science and ML ecosystem",
      providers: ["Any cloud/container platform"],
    },
    {
      id: "rust-actix",
      name: "Rust (Actix/Axum)",
      throughput: "100K-500K req/sec",
      limits: "No GC, memory-safe without runtime overhead",
      purpose: "Systems-level performance with memory safety guarantees",
      providers: ["Any cloud/container platform"],
    },
    {
      id: "dotnet",
      name: ".NET (ASP.NET Core)",
      throughput: "20K-100K req/sec",
      limits: "No hard limits, async/await concurrency model",
      purpose: "Cross-platform high-performance framework with enterprise support",
      providers: ["Azure App Service", "Any cloud/container platform"],
    },
    {
      id: "elixir-phoenix",
      name: "Elixir (Phoenix)",
      throughput: "50K-200K concurrent connections",
      limits: "BEAM VM soft real-time, per-process heap",
      purpose: "Fault-tolerant concurrent services leveraging Erlang VM",
      providers: ["Any cloud/container platform", "Fly.io"],
    },
    {
      id: "grpc",
      name: "gRPC Service",
      throughput: "50K-200K req/sec",
      limits: "4 MB default message size, configurable",
      purpose: "High-performance RPC framework with Protobuf serialization",
      providers: ["Any cloud/container platform"],
    },
  ],

  cache: [
    {
      ref: "redis",
      throughput: "100K-500K ops/sec (single node)",
      limits: "512 MB max value size, max memory configurable",
      purpose: "In-memory data structure store for caching, sessions, and pub/sub",
    },
    {
      id: "memcached",
      name: "Memcached",
      throughput: "200K-700K ops/sec",
      limits: "1 MB max value size, no persistence",
      purpose: "Simple high-performance distributed memory cache",
      providers: ["AWS ElastiCache", "GCP Memorystore"],
    },
    {
      id: "dragonfly",
      name: "Dragonfly",
      throughput: "1M+ ops/sec (single instance)",
      limits: "Redis-compatible, utilizes all CPU cores",
      purpose: "Modern in-memory store, multi-threaded Redis replacement",
      providers: ["Dragonfly Cloud", "Self-hosted"],
    },
    {
      id: "keydb",
      name: "KeyDB",
      throughput: "500K+ ops/sec",
      limits: "Redis-compatible, multi-threaded",
      purpose: "Multi-threaded fork of Redis with active replication",
      providers: ["Self-hosted", "Snap"],
    },
    {
      id: "hazelcast",
      name: "Hazelcast",
      throughput: "100K+ ops/sec per node",
      limits: "Configurable, distributed across cluster",
      purpose: "Distributed in-memory computing platform with data grid",
      providers: ["Hazelcast Cloud", "AWS Marketplace"],
    },
    {
      id: "varnish",
      name: "Varnish",
      throughput: "100K+ req/sec",
      limits: "Disk + memory, configurable",
      purpose: "HTTP accelerator for content-heavy web applications",
      providers: ["Self-hosted", "Fastly (Varnish-based)"],
    },
    {
      id: "cdn-edge-cache",
      name: "CDN Edge Cache",
      throughput: "Millions of req/sec globally",
      limits: "Varies by provider, typically 512 MB max object",
      purpose: "Edge caching layer for static and dynamic content",
      providers: ["Cloudflare", "Fastly", "AWS CloudFront"],
    },
  ],

  "message-queue": [
    {
      ref: "kafka",
      throughput: "1M+ messages/sec per broker",
      limits: "1 MB default message size, retention configurable",
      purpose: "Distributed event streaming platform for high-throughput pipelines",
    },
    {
      ref: "redis",
      throughput: "100K+ messages/sec",
      limits: "Bounded by Redis memory, configurable max length",
      purpose: "Lightweight pub/sub and append-only streams for event-driven architectures",
    },
    {
      id: "rabbitmq",
      name: "RabbitMQ",
      throughput: "20K-50K messages/sec per node",
      limits: "128 MB default max message size, configurable",
      purpose: "Feature-rich message broker with flexible routing (AMQP)",
      providers: ["AWS Amazon MQ", "CloudAMQP", "Azure"],
    },
    {
      id: "sqs",
      name: "Amazon SQS",
      throughput: "Unlimited (standard), 3K msg/sec (FIFO)",
      limits: "256 KB max message size, 14 days retention",
      purpose: "Fully managed serverless message queue",
      providers: ["AWS"],
    },
    {
      id: "google-pubsub",
      name: "Google Pub/Sub",
      throughput: "Unlimited with auto-scaling",
      limits: "10 MB max message size, 31 days retention",
      purpose: "Fully managed real-time messaging with global ordering",
      providers: ["GCP"],
    },
    {
      id: "nats",
      name: "NATS",
      throughput: "10M+ messages/sec",
      limits: "1 MB default max message size, configurable",
      purpose: "Lightweight cloud-native messaging with at-most-once and JetStream",
      providers: ["Synadia Cloud", "Self-hosted"],
    },
    {
      id: "pulsar",
      name: "Apache Pulsar",
      throughput: "1M+ messages/sec",
      limits: "5 MB default max message size, tiered storage",
      purpose: "Multi-tenant distributed messaging with built-in geo-replication",
      providers: ["StreamNative Cloud", "AWS Marketplace"],
    },
    {
      id: "azure-service-bus",
      name: "Azure Service Bus",
      throughput: "Thousands of msg/sec per unit",
      limits: "256 KB-100 MB depending on tier, 14 days default retention",
      purpose: "Enterprise message broker with transactions and dead-lettering",
      providers: ["Azure"],
    },
  ],

  storage: [
    {
      id: "s3",
      name: "Amazon S3",
      throughput: "5500 GET/sec, 3500 PUT/sec per prefix",
      limits: "5 TB max object size, unlimited total storage",
      purpose: "Industry-standard object storage with 11 nines durability",
      providers: ["AWS"],
    },
    {
      id: "gcs",
      name: "Google Cloud Storage",
      throughput: "5000 reads/sec, 1000 writes/sec per bucket",
      limits: "5 TB max object size, unlimited total storage",
      purpose: "Unified object storage with multi-region and autoclass",
      providers: ["GCP"],
    },
    {
      id: "azure-blob",
      name: "Azure Blob Storage",
      throughput: "20K req/sec per account",
      limits: "4.75 TB max block blob, unlimited total storage",
      purpose: "Scalable object storage with hot/cool/archive tiers",
      providers: ["Azure"],
    },
    {
      id: "minio",
      name: "MinIO",
      throughput: "Varies by hardware, 100+ Gbps tested",
      limits: "5 TB max object size, S3-compatible",
      purpose: "High-performance S3-compatible object storage for private cloud",
      providers: ["Self-hosted", "MinIO Cloud"],
    },
    {
      id: "r2",
      name: "Cloudflare R2",
      throughput: "1000+ req/sec",
      limits: "5 TB max object size, no egress fees",
      purpose: "S3-compatible object storage with zero egress cost",
      providers: ["Cloudflare"],
    },
    {
      id: "efs",
      name: "Amazon EFS",
      throughput: "3-10+ GB/sec depending on mode",
      limits: "No max file system size, 256 bytes min I/O",
      purpose: "Managed elastic NFS file system for shared workloads",
      providers: ["AWS"],
    },
    {
      id: "ebs",
      name: "Amazon EBS",
      throughput: "Up to 4000 MB/sec (io2 Block Express)",
      limits: "64 TB max volume size, single-AZ",
      purpose: "Block storage volumes for EC2 instances",
      providers: ["AWS"],
    },
    {
      id: "ceph",
      name: "Ceph",
      throughput: "Varies by cluster, multi-GB/sec",
      limits: "No hard limits, scales horizontally",
      purpose: "Unified distributed storage providing block, file, and object",
      providers: ["Self-hosted", "Red Hat Ceph"],
    },
  ],

  cdn: [
    {
      id: "cloudflare-cdn",
      name: "Cloudflare CDN",
      throughput: "Millions of req/sec globally",
      limits: "100 MB free plan upload, 500 MB pro plan",
      purpose: "Global edge network with integrated security and Workers",
      providers: ["Cloudflare"],
    },
    {
      id: "cloudfront",
      name: "AWS CloudFront",
      throughput: "250K req/sec default (adjustable)",
      limits: "30 GB max object, 250K RPS soft limit",
      purpose: "Global CDN tightly integrated with AWS ecosystem",
      providers: ["AWS"],
    },
    {
      id: "fastly",
      name: "Fastly",
      throughput: "Millions of req/sec at edge",
      limits: "5 GB max object, configurable",
      purpose: "Edge cloud platform with real-time purging and Compute@Edge",
      providers: ["Fastly"],
    },
    {
      id: "akamai",
      name: "Akamai",
      throughput: "Millions of req/sec",
      limits: "Configurable per contract",
      purpose: "World's largest CDN with advanced security and performance",
      providers: ["Akamai"],
    },
    {
      id: "azure-cdn",
      name: "Azure CDN",
      throughput: "Varies by tier",
      limits: "Configurable per profile",
      purpose: "Global CDN with Microsoft and Verizon PoP networks",
      providers: ["Azure"],
    },
    {
      id: "gcp-cloud-cdn",
      name: "GCP Cloud CDN",
      throughput: "Scales with Google's edge network",
      limits: "10 MB max cacheable object default",
      purpose: "CDN integrated with Google Cloud load balancing",
      providers: ["GCP"],
    },
    {
      id: "vercel-edge",
      name: "Vercel Edge Network",
      throughput: "Auto-scaling at edge",
      limits: "4 MB serverless function response, 50 MB edge function",
      purpose: "Frontend-optimized edge network with ISR and edge functions",
      providers: ["Vercel"],
    },
  ],

  "load-balancer": [
    {
      ref: "nginx",
      throughput: "100K+ req/sec",
      limits: "Configurable, worker-process based",
      purpose: "High-performance HTTP and TCP/UDP load balancer",
    },
    {
      ref: "envoy",
      throughput: "100K+ req/sec",
      limits: "Configurable, L4/L7",
      purpose: "Programmable edge and service proxy for modern architectures",
    },
    {
      id: "haproxy",
      name: "HAProxy",
      throughput: "200K+ req/sec, millions of concurrent connections",
      limits: "Configurable, minimal overhead",
      purpose: "Reliable, high-performance TCP/HTTP load balancer",
      providers: ["Self-hosted", "HAProxy Cloud"],
    },
    {
      id: "aws-alb",
      name: "AWS ALB",
      throughput: "Auto-scaling, no pre-provisioning needed",
      limits: "100 targets per target group default, adjustable",
      purpose: "Layer 7 load balancer with content-based routing",
      providers: ["AWS"],
    },
    {
      id: "aws-nlb",
      name: "AWS NLB",
      throughput: "Millions of req/sec, ultra-low latency",
      limits: "Static IP per AZ, TCP/UDP/TLS",
      purpose: "Layer 4 load balancer for extreme performance",
      providers: ["AWS"],
    },
    {
      id: "gcp-cloud-lb",
      name: "GCP Cloud Load Balancing",
      throughput: "Millions of req/sec",
      limits: "Global or regional, configurable",
      purpose: "Global anycast load balancing with auto-scaling",
      providers: ["GCP"],
    },
    {
      id: "azure-lb",
      name: "Azure Load Balancer",
      throughput: "Millions of flows",
      limits: "Standard SKU supports availability zones",
      purpose: "Layer 4 load balancer for Azure virtual networks",
      providers: ["Azure"],
    },
  ],

  firewall: [
    {
      id: "aws-waf",
      name: "AWS WAF",
      throughput: "Millions of req/sec",
      limits: "10 rules per web ACL default (adjustable), 8 KB header inspection",
      purpose: "Web application firewall for AWS resources",
      providers: ["AWS"],
    },
    {
      id: "cloudflare-waf",
      name: "Cloudflare WAF",
      throughput: "Unlimited at edge",
      limits: "Configurable rules per zone",
      purpose: "Edge-deployed WAF with managed and custom rulesets",
      providers: ["Cloudflare"],
    },
    {
      id: "aws-security-groups",
      name: "AWS Security Groups",
      throughput: "No performance impact (stateful)",
      limits: "60 inbound + 60 outbound rules per SG",
      purpose: "Virtual firewall for EC2 instance-level network control",
      providers: ["AWS"],
    },
    {
      id: "azure-firewall",
      name: "Azure Firewall",
      throughput: "30 Gbps",
      limits: "Configurable rules, FQDN filtering",
      purpose: "Managed network security service for Azure VNets",
      providers: ["Azure"],
    },
    {
      id: "gcp-cloud-armor",
      name: "GCP Cloud Armor",
      throughput: "Scales with Google's edge",
      limits: "Configurable, per-project quotas",
      purpose: "DDoS protection and WAF for Google Cloud workloads",
      providers: ["GCP"],
    },
    {
      id: "palo-alto",
      name: "Palo Alto Networks",
      throughput: "Varies by model (up to 100 Gbps)",
      limits: "Model-dependent",
      purpose: "Enterprise next-generation firewall with threat prevention",
      providers: ["Palo Alto Cloud NGFW", "Self-hosted"],
    },
    {
      id: "modsecurity",
      name: "ModSecurity",
      throughput: "Depends on host (10K-50K req/sec typical)",
      limits: "Configurable, runs as module in Nginx/Apache",
      purpose: "Open-source WAF engine with OWASP Core Rule Set",
      providers: ["Self-hosted"],
    },
  ],

  webhook: [
    {
      ref: "eventbridge",
      throughput: "Thousands of events/sec",
      limits: "256 KB max event size, 5 targets per rule default",
      purpose: "Serverless event bus for routing between AWS services",
    },
    {
      id: "svix",
      name: "Svix",
      throughput: "10K+ deliveries/sec",
      limits: "Configurable retry policies, 30 day message retention",
      purpose: "Enterprise webhook delivery platform with retry and verification",
      providers: ["Svix Cloud", "Self-hosted"],
    },
    {
      id: "hookdeck",
      name: "Hookdeck",
      throughput: "Thousands of events/sec",
      limits: "Configurable rate limits, 30 day retention",
      purpose: "Webhook infrastructure for reliable ingestion and delivery",
      providers: ["Hookdeck Cloud"],
    },
    {
      id: "zapier-webhooks",
      name: "Zapier Webhooks",
      throughput: "Varies by plan",
      limits: "10 MB max payload, plan-dependent rate limits",
      purpose: "No-code webhook integration and automation platform",
      providers: ["Zapier"],
    },
    {
      id: "ngrok",
      name: "ngrok",
      throughput: "Varies by plan",
      limits: "Plan-dependent connections and bandwidth",
      purpose: "Ingress-as-a-service for exposing local services via webhook",
      providers: ["ngrok Cloud"],
    },
    {
      id: "custom-webhook",
      name: "Custom (Express/FastAPI)",
      throughput: "Depends on backend (5K-50K req/sec)",
      limits: "Application-dependent",
      purpose: "Self-built webhook endpoint with custom validation and processing",
      providers: ["Any cloud/container platform"],
    },
  ],

  cron: [
    {
      ref: "eventbridge",
      throughput: "Millions of schedules",
      limits: "14 month scheduling window, 1 second granularity",
      purpose: "Serverless task scheduler with native AWS integration",
    },
    {
      id: "gcp-cloud-scheduler",
      name: "GCP Cloud Scheduler",
      throughput: "Thousands of jobs",
      limits: "500 jobs per project, 1 minute minimum interval",
      purpose: "Managed cron job service for GCP",
      providers: ["GCP"],
    },
    {
      id: "linux-cron",
      name: "Cron (Linux)",
      throughput: "N/A (process launcher)",
      limits: "1 minute minimum granularity",
      purpose: "Standard Unix job scheduler for recurring tasks",
      providers: ["Any Linux server"],
    },
    {
      id: "k8s-cronjob",
      name: "Kubernetes CronJob",
      throughput: "Cluster-dependent",
      limits: "100 CronJobs per namespace default, 1 minute granularity",
      purpose: "Kubernetes-native scheduled job execution",
      providers: ["Any Kubernetes cluster"],
    },
    {
      id: "celery-beat",
      name: "Celery Beat",
      throughput: "Application-dependent",
      limits: "Python, requires broker (Redis/RabbitMQ)",
      purpose: "Periodic task scheduler for Python Celery workers",
      providers: ["Self-hosted"],
    },
    {
      id: "temporal",
      name: "Temporal",
      throughput: "10K+ workflows/sec per namespace",
      limits: "Configurable, 50 MB max event history",
      purpose: "Durable execution platform for reliable scheduled workflows",
      providers: ["Temporal Cloud", "Self-hosted"],
    },
    {
      id: "azure-logic-apps",
      name: "Azure Logic Apps",
      throughput: "Varies by tier",
      limits: "Recurrence trigger configurable, 4 MB action input",
      purpose: "Low-code workflow automation with scheduling triggers",
      providers: ["Azure"],
    },
  ],

  client: [
    {
      id: "react",
      name: "React",
      throughput: "N/A (client framework)",
      limits: "Browser memory, no hard limits",
      purpose: "Component-based UI library for building interactive web apps",
      providers: ["Vercel", "Netlify", "Any static host"],
    },
    {
      id: "nextjs",
      name: "Next.js",
      throughput: "N/A (framework, SSR/ISR capable)",
      limits: "50 MB serverless function, 4 MB edge function",
      purpose: "Full-stack React framework with SSR, SSG, and API routes",
      providers: ["Vercel", "AWS Amplify", "Any Node.js host"],
    },
    {
      id: "vuejs",
      name: "Vue.js",
      throughput: "N/A (client framework)",
      limits: "Browser memory, no hard limits",
      purpose: "Progressive framework for building approachable UIs",
      providers: ["Any static host"],
    },
    {
      id: "angular",
      name: "Angular",
      throughput: "N/A (client framework)",
      limits: "Browser memory, no hard limits",
      purpose: "Full-featured enterprise framework with dependency injection",
      providers: ["Any static host", "Firebase Hosting"],
    },
    {
      id: "react-native",
      name: "React Native",
      throughput: "60 FPS target",
      limits: "Platform-dependent (iOS/Android)",
      purpose: "Cross-platform mobile development with React",
      providers: ["App Store", "Google Play", "Expo"],
    },
    {
      id: "flutter",
      name: "Flutter",
      throughput: "60-120 FPS",
      limits: "Platform-dependent",
      purpose: "Cross-platform UI toolkit with Dart for mobile, web, and desktop",
      providers: ["App Store", "Google Play", "Web"],
    },
    {
      id: "swiftui",
      name: "Swift/SwiftUI",
      throughput: "Native performance",
      limits: "iOS/macOS platform limits",
      purpose: "Native Apple platform development",
      providers: ["App Store"],
    },
    {
      id: "kotlin-compose",
      name: "Kotlin/Jetpack Compose",
      throughput: "Native performance",
      limits: "Android platform limits",
      purpose: "Modern Android native development with declarative UI",
      providers: ["Google Play"],
    },
  ],

  "search-engine": [
    {
      id: "elasticsearch",
      name: "Elasticsearch",
      throughput: "10K-50K queries/sec per node",
      limits: "No hard index size limit, ~2 billion documents per shard recommended",
      purpose: "Distributed search and analytics engine built on Apache Lucene",
      providers: ["Elastic Cloud", "AWS OpenSearch", "Azure"],
    },
    {
      id: "opensearch",
      name: "OpenSearch",
      throughput: "10K-50K queries/sec per node",
      limits: "Similar to Elasticsearch (Lucene-based)",
      purpose: "Open-source fork of Elasticsearch for search and observability",
      providers: ["AWS OpenSearch", "Self-hosted"],
    },
    {
      id: "typesense",
      name: "Typesense",
      throughput: "1K-10K queries/sec",
      limits: "In-memory, limited by RAM",
      purpose: "Fast typo-tolerant search engine optimized for instant search",
      providers: ["Typesense Cloud", "Self-hosted"],
    },
    {
      id: "meilisearch",
      name: "Meilisearch",
      throughput: "1K-5K queries/sec",
      limits: "100 GB recommended max dataset, 500 indexes",
      purpose: "Lightning-fast search with typo tolerance and easy setup",
      providers: ["Meilisearch Cloud", "Self-hosted"],
    },
    {
      id: "algolia",
      name: "Algolia",
      throughput: "Thousands of queries/sec",
      limits: "100 KB max record size, plan-dependent operations",
      purpose: "Hosted search API for fast, relevant search experiences",
      providers: ["Algolia"],
    },
    {
      id: "solr",
      name: "Apache Solr",
      throughput: "10K-50K queries/sec per node",
      limits: "No hard limits, Lucene-based",
      purpose: "Enterprise search platform with rich text processing",
      providers: ["Self-hosted", "SearchStax"],
    },
    {
      id: "pinecone",
      name: "Pinecone",
      throughput: "Thousands of queries/sec",
      limits: "40 KB max metadata per vector, plan-dependent",
      purpose: "Vector database for similarity search and AI applications",
      providers: ["Pinecone"],
    },
  ],

  dns: [
    {
      id: "route53",
      name: "AWS Route 53",
      throughput: "Unlimited queries",
      limits: "500 hosted zones, 10K records per zone default",
      purpose: "Highly available DNS with health checking and traffic routing",
      providers: ["AWS"],
    },
    {
      id: "cloudflare-dns",
      name: "Cloudflare DNS",
      throughput: "Unlimited queries",
      limits: "3500 DNS records per zone (free)",
      purpose: "Fastest authoritative DNS with global anycast and DDoS protection",
      providers: ["Cloudflare"],
    },
    {
      id: "gcp-cloud-dns",
      name: "GCP Cloud DNS",
      throughput: "Unlimited queries",
      limits: "10K records per zone, 100 zones per project",
      purpose: "Managed authoritative DNS on Google's infrastructure",
      providers: ["GCP"],
    },
    {
      id: "azure-dns",
      name: "Azure DNS",
      throughput: "Unlimited queries",
      limits: "10K records per zone",
      purpose: "DNS hosting on Azure's global anycast network",
      providers: ["Azure"],
    },
    {
      id: "ns1",
      name: "NS1 (IBM)",
      throughput: "Millions of queries/sec",
      limits: "Plan-dependent zones and records",
      purpose: "Intelligent DNS with traffic management and filter chains",
      providers: ["NS1/IBM Cloud"],
    },
    {
      id: "coredns",
      name: "CoreDNS",
      throughput: "50K+ queries/sec",
      limits: "Configurable, plugin-based",
      purpose: "Flexible DNS server and Kubernetes default cluster DNS",
      providers: ["Self-hosted", "Kubernetes built-in"],
    },
  ],

  serverless: [
    {
      id: "lambda",
      name: "AWS Lambda",
      throughput: "1000 concurrent default (adjustable to 10K+)",
      limits: "15 min timeout, 10 GB memory, 250 MB package (unzipped)",
      purpose: "Event-driven serverless compute with broad trigger integration",
      providers: ["AWS"],
    },
    {
      id: "gcf",
      name: "Google Cloud Functions",
      throughput: "1000 concurrent default per function",
      limits: "9 min (1st gen) / 60 min (2nd gen), 32 GB memory",
      purpose: "Lightweight serverless functions on Google Cloud",
      providers: ["GCP"],
    },
    {
      id: "azure-functions",
      name: "Azure Functions",
      throughput: "200 instances per function app default",
      limits: "10 min (consumption), 230 sec HTTP trigger, 1.5 GB memory",
      purpose: "Event-driven serverless compute with durable functions",
      providers: ["Azure"],
    },
    {
      id: "cf-workers",
      name: "Cloudflare Workers",
      throughput: "Millions of req/sec at edge",
      limits: "128 MB memory, 10-30 ms CPU time (free), 50 ms (paid)",
      purpose: "Edge-deployed serverless with V8 isolates for ultra-low latency",
      providers: ["Cloudflare"],
    },
    {
      id: "vercel-functions",
      name: "Vercel Functions",
      throughput: "Auto-scaling",
      limits: "10 sec (hobby) / 300 sec (pro) timeout, 50 MB function size",
      purpose: "Serverless functions optimized for Next.js and frontend frameworks",
      providers: ["Vercel"],
    },
    {
      id: "fargate",
      name: "AWS Fargate",
      throughput: "Auto-scaling tasks",
      limits: "4 vCPU, 30 GB memory per task",
      purpose: "Serverless containers without managing infrastructure",
      providers: ["AWS"],
    },
    {
      id: "cloud-run",
      name: "Google Cloud Run",
      throughput: "1000 concurrent per instance default",
      limits: "60 min timeout, 32 GB memory, 8 vCPU",
      purpose: "Serverless containers with scale-to-zero and request-based billing",
      providers: ["GCP"],
    },
  ],

  "container-orchestration": [
    {
      id: "k8s",
      name: "Kubernetes (K8s)",
      throughput: "5000 nodes, 150K pods per cluster",
      limits: "300K total containers, 110 pods per node default",
      purpose: "Industry-standard container orchestration for production workloads",
      providers: ["AWS EKS", "GCP GKE", "Azure AKS", "Self-hosted"],
    },
    {
      id: "ecs",
      name: "Amazon ECS",
      throughput: "Thousands of tasks per cluster",
      limits: "5000 services per cluster, 10 containers per task",
      purpose: "AWS-native container orchestration with deep service integration",
      providers: ["AWS"],
    },
    {
      id: "docker-swarm",
      name: "Docker Swarm",
      throughput: "Thousands of containers per cluster",
      limits: "No hard limits, simpler than K8s",
      purpose: "Lightweight Docker-native container orchestration",
      providers: ["Self-hosted"],
    },
    {
      id: "nomad",
      name: "Nomad (HashiCorp)",
      throughput: "10K+ allocations per cluster",
      limits: "Configurable, supports containers and non-containers",
      purpose: "Flexible workload orchestrator for containers, VMs, and binaries",
      providers: ["HashiCorp Cloud", "Self-hosted"],
    },
    {
      id: "openshift",
      name: "Red Hat OpenShift",
      throughput: "Similar to Kubernetes (built on K8s)",
      limits: "Cluster-size dependent",
      purpose: "Enterprise Kubernetes platform with integrated CI/CD and developer tools",
      providers: ["Red Hat Cloud", "AWS ROSA", "Azure ARO"],
    },
    {
      id: "gke-autopilot",
      name: "GKE Autopilot",
      throughput: "Auto-scaling, managed node pools",
      limits: "Per-pod resource limits, Google-managed nodes",
      purpose: "Fully managed Kubernetes with per-pod billing and auto-provisioning",
      providers: ["GCP"],
    },
  ],

  "stream-processor": [
    {
      ref: "kafka",
      throughput: "100K-1M events/sec per instance",
      limits: "JVM-based, depends on state store size",
      purpose: "Lightweight stream processing library (Kafka Streams) built on Kafka",
    },
    {
      ref: "flink",
      throughput: "Millions of events/sec per cluster",
      limits: "State size limited by disk, configurable checkpoints",
      purpose: "Stateful stream processing with exactly-once semantics",
    },
    {
      id: "spark-streaming",
      name: "Apache Spark Streaming",
      throughput: "100K-1M events/sec",
      limits: "Micro-batch based, latency 100ms-seconds",
      purpose: "Micro-batch stream processing integrated with Spark ecosystem",
      providers: ["AWS EMR", "Databricks", "GCP Dataproc"],
    },
    {
      id: "kinesis-streams",
      name: "AWS Kinesis Data Streams",
      throughput: "1 MB/sec per shard write, 2 MB/sec read",
      limits: "1 MB max record, 500 shards per account default",
      purpose: "Managed real-time data streaming on AWS",
      providers: ["AWS"],
    },
    {
      id: "dataflow",
      name: "Google Dataflow",
      throughput: "Auto-scaling, millions of events/sec",
      limits: "Configurable workers, unified batch and stream",
      purpose: "Fully managed stream and batch processing (Apache Beam)",
      providers: ["GCP"],
    },
    {
      id: "kinesis-firehose",
      name: "Amazon Kinesis Data Firehose",
      throughput: "Auto-scaling delivery",
      limits: "1 MB max record, 60-900 sec buffer",
      purpose: "Serverless streaming ETL to data stores and analytics",
      providers: ["AWS"],
    },
    {
      id: "risingwave",
      name: "RisingWave",
      throughput: "100K+ events/sec",
      limits: "PostgreSQL-compatible, cloud-native",
      purpose: "Streaming database for real-time materialized views with SQL",
      providers: ["RisingWave Cloud", "Self-hosted"],
    },
  ],

  "data-warehouse": [
    {
      id: "snowflake",
      name: "Snowflake",
      throughput: "Auto-scaling compute, near-unlimited concurrency",
      limits: "No storage limit, 16 MB max VARCHAR, compute credit-based",
      purpose: "Cloud-native data warehouse with separation of compute and storage",
      providers: ["Snowflake (AWS/GCP/Azure)"],
    },
    {
      id: "bigquery",
      name: "Google BigQuery",
      throughput: "Scans TB in seconds, auto-scaling slots",
      limits: "10 MB max row size, 4000 columns per table, 10 TB per query",
      purpose: "Serverless columnar data warehouse with built-in ML",
      providers: ["GCP"],
    },
    {
      id: "redshift",
      name: "Amazon Redshift",
      throughput: "Varies by cluster, RA3 nodes scale independently",
      limits: "1.6 PB per cluster (RA3), 60 user tables per schema for Serverless",
      purpose: "Petabyte-scale columnar warehouse with Spectrum for S3 queries",
      providers: ["AWS"],
    },
    {
      id: "databricks",
      name: "Databricks (Lakehouse)",
      throughput: "Auto-scaling clusters",
      limits: "Based on underlying cloud storage, no fixed data size limits",
      purpose: "Unified analytics platform combining data lake and warehouse",
      providers: ["Databricks (AWS/GCP/Azure)"],
    },
    {
      id: "clickhouse",
      name: "ClickHouse",
      throughput: "Millions of rows/sec analytical queries",
      limits: "No hard row count limit, columnar compression",
      purpose: "Blazing-fast OLAP column-oriented database for real-time analytics",
      providers: ["ClickHouse Cloud", "AWS Marketplace", "Self-hosted"],
    },
    {
      id: "druid",
      name: "Apache Druid",
      throughput: "Sub-second OLAP queries on billions of rows",
      limits: "Depends on cluster, segment-based storage",
      purpose: "Real-time analytics database for high-concurrency OLAP queries",
      providers: ["Imply Cloud", "AWS Marketplace", "Self-hosted"],
    },
    {
      id: "duckdb",
      name: "DuckDB",
      throughput: "Billions of rows per query (single-node)",
      limits: "Limited by local memory/disk",
      purpose: "Embedded analytical database for local OLAP on files and data frames",
      providers: ["Embedded (in-process)", "MotherDuck (cloud)"],
    },
  ],
};

// ---------------------------------------------------------------------------
// Resolved catalog – the public export
// ---------------------------------------------------------------------------

export const TECHNOLOGY_CATALOG: Record<ComponentType, TechnologyInfo[]> = (
  Object.keys(RAW_CATALOG) as ComponentType[]
).reduce(
  (acc, key) => {
    acc[key] = RAW_CATALOG[key].map(resolve);
    return acc;
  },
  {} as Record<ComponentType, TechnologyInfo[]>,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up a single technology by component type and display name.
 */
export function getTechnology(
  componentType: ComponentType,
  name: string,
): TechnologyInfo | undefined {
  return TECHNOLOGY_CATALOG[componentType]?.find((t) => t.name === name);
}

/**
 * Return every category a technology id appears in.
 */
export function getTechnologyCategories(id: string): ComponentType[] {
  return (Object.keys(TECHNOLOGY_CATALOG) as ComponentType[]).filter((category) =>
    TECHNOLOGY_CATALOG[category].some((t) => t.id === id),
  );
}
