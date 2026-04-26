# Component Reference

18 built-in component types organized by category. Each component has a set of plan fields for configuration and a list of valid outgoing connection targets.

## Compute

### Service

General-purpose application server — the workhorse of most architectures.

| Field        | Example                                  |
| ------------ | ---------------------------------------- |
| Technology   | Node.js, Go, Java Spring, Python FastAPI |
| Endpoints    | `GET /users`, `POST /orders`             |
| Replicas     | `3`                                      |
| Dependencies | `database, cache`                        |

**Connects to:** Database, Cache, Message Queue, Storage, Search Engine, Data Warehouse, Stream Processor, Webhook, Service

### Serverless

Event-driven compute functions with automatic scaling and per-invocation billing.

| Field      | Example                                      |
| ---------- | -------------------------------------------- |
| Technology | AWS Lambda, Cloud Functions, Azure Functions |
| Trigger    | `HTTP`, `S3 event`, `schedule`               |
| Runtime    | `Node.js 20`, `Python 3.12`                  |
| Memory     | `512 MB`                                     |
| Timeout    | `30s`                                        |

**Connects to:** Database, Cache, Message Queue, Storage, Search Engine, Data Warehouse, Stream Processor, Webhook, Serverless

### Containers

Container orchestration platforms for managing service deployments.

| Field           | Example                 |
| --------------- | ----------------------- |
| Technology      | Kubernetes, ECS         |
| Cluster Size    | `3 nodes`               |
| Namespace       | `production`            |
| Deploy Strategy | `Rolling`, `blue-green` |
| Resources       | `2 vCPU, 4 GB per pod`  |

**Connects to:** Service, Database, Cache, Message Queue, Storage, Serverless

## Data

### Database

Persistent data storage — relational, document, key-value, or graph.

| Field       | Example                                                                          |
| ----------- | -------------------------------------------------------------------------------- |
| Technology  | PostgreSQL, MySQL, MongoDB, DynamoDB, Cassandra, Aurora, CockroachDB, SQL Server |
| Tables      | `users, orders, products`                                                        |
| Primary Key | `id (UUID)`                                                                      |
| Sort Key    | `created_at`                                                                     |
| Indexes     | `email_idx, status_idx`                                                          |

**Connects to:** Message Queue, Stream Processor

### Cache

In-memory data store for reducing latency and database load.

| Field           | Example                       |
| --------------- | ----------------------------- |
| Technology      | Redis, Memcached              |
| Strategy        | `Write-through`, `Write-back` |
| TTL             | `3600s`                       |
| Eviction Policy | `LRU`, `LFU`                  |
| Max Size        | `512 MB`                      |

**Connects to:** _(none — caches are connection targets, not sources)_

### Search Engine

Full-text and vector search indexing.

| Field      | Example                                                 |
| ---------- | ------------------------------------------------------- |
| Technology | Elasticsearch, OpenSearch, Meilisearch, Typesense, Solr |
| Index Name | `products, articles`                                    |
| Query Type | `Full-text`, `vector`, `hybrid`                         |
| Replicas   | `2`                                                     |
| Analyzer   | `Standard`, `custom`                                    |

**Connects to:** _(none — search engines are connection targets)_

### Data Warehouse

Columnar storage for analytics and reporting workloads.

| Field        | Example                                   |
| ------------ | ----------------------------------------- |
| Technology   | ClickHouse, Redshift, BigQuery, Snowflake |
| Tables       | `fact_orders, dim_users`                  |
| Partitioning | `By date, monthly`                        |
| Compression  | `Columnar`, `Zstd`                        |
| Query Engine | `SQL`, `Spark SQL`                        |

**Connects to:** _(none — warehouses are connection targets)_

## Networking

### API Gateway

Request routing, authentication, rate limiting, and API management.

| Field       | Example                             |
| ----------- | ----------------------------------- |
| Technology  | AWS API Gateway, Nginx, Kong, Envoy |
| Auth Method | `JWT`, `API Key`, `OAuth`           |
| Rate Limit  | `1000 req/min`                      |
| CORS        | `*.example.com`                     |

**Connects to:** Service, Serverless, Containers, API Gateway

### Load Balancer

Traffic distribution across service replicas.

| Field        | Example                     |
| ------------ | --------------------------- |
| Technology   | AWS ALB, Nginx              |
| Algorithm    | `Round Robin`, `Least Conn` |
| Health Check | `/health`, `10s interval`   |
| Targets      | `service-a, service-b`      |
| Protocol     | `HTTP`, `gRPC`, `TCP`       |

**Connects to:** Service, API Gateway, Serverless, Containers, Load Balancer

### CDN

Content delivery network for edge caching and static asset distribution.

| Field          | Example           |
| -------------- | ----------------- |
| Technology     | CloudFront        |
| Origins        | `api.example.com` |
| Cache Rules    | `static/* 30d`    |
| Edge Locations | `Global`          |

**Connects to:** Load Balancer, API Gateway, Storage

### DNS

Domain name resolution and traffic routing policies.

| Field          | Example                              |
| -------------- | ------------------------------------ |
| Technology     | Route 53                             |
| Domain         | `example.com`                        |
| Record Types   | `A, CNAME, MX`                       |
| Routing Policy | `Latency`, `weighted`, `geolocation` |
| TTL            | `300s`                               |

**Connects to:** CDN, Load Balancer, API Gateway, Firewall, Storage

### Firewall

Network security, WAF rules, and access control.

| Field          | Example           |
| -------------- | ----------------- |
| Technology     | AWS WAF           |
| Inbound Rules  | `443/tcp, 80/tcp` |
| Outbound Rules | `All traffic`     |
| Allowed IPs    | `10.0.0.0/8`      |
| WAF Rules      | `OWASP Top 10`    |

**Connects to:** Load Balancer, API Gateway, Service, Serverless

## Messaging

### Message Queue

Asynchronous message delivery with durability and ordering guarantees.

| Field      | Example                                    |
| ---------- | ------------------------------------------ |
| Technology | Kafka, SQS, RabbitMQ, Redis, NATS, Pub/Sub |
| Topics     | `user.created, order.placed`               |
| Retention  | `7 days`                                   |
| Delivery   | `At-least-once`, `Exactly-once`            |
| Partitions | `12`                                       |

**Connects to:** Service, Serverless, Stream Processor, Webhook

### Stream Processor

Real-time event processing with windowing, aggregation, and exactly-once semantics.

| Field         | Example                       |
| ------------- | ----------------------------- |
| Technology    | Kinesis, Flink, RisingWave    |
| Input Source  | `Kafka topic, Kinesis stream` |
| Output Sink   | `S3, database, another topic` |
| Window Type   | `Tumbling 5m`, `sliding 1m`   |
| Checkpointing | `Every 60s`                   |

**Connects to:** Database, Data Warehouse, Storage, Message Queue, Service, Serverless

### Webhook

HTTP callback notifications to external or internal endpoints.

| Field      | Example                        |
| ---------- | ------------------------------ |
| Technology | SNS, custom                    |
| URL        | `https://api.example.com/hook` |
| Method     | `POST`                         |
| Headers    | `Authorization, Content-Type`  |
| Retries    | `3 with exponential backoff`   |

**Connects to:** Service, Serverless, API Gateway

## Storage

### Storage

Object and blob storage for files, backups, and static assets.

| Field         | Example                 |
| ------------- | ----------------------- |
| Technology    | S3, GCS, Azure Blob, R2 |
| Bucket / Path | `s3://my-bucket`        |
| Replication   | `Cross-region`          |
| Encryption    | `AES-256`               |
| Lifecycle     | `Archive after 90d`     |

**Connects to:** Serverless, Stream Processor

## Scheduling

### Cron

Scheduled job execution on a recurring basis.

| Field      | Example                 |
| ---------- | ----------------------- |
| Technology | EventBridge, Linux Cron |
| Schedule   | `0 */6 * * *`           |
| Command    | `node cleanup.js`       |
| Timeout    | `300s`                  |
| Alert On   | `Failure, timeout`      |

**Connects to:** Service, Serverless, Message Queue, Webhook, Database

## Client

### Client

End-user applications — web browsers, mobile apps, desktop clients.

| Field      | Example                      |
| ---------- | ---------------------------- |
| Technology | React, Next.js, iOS, Android |
| Platform   | `Web, iOS, Android`          |
| Auth Flow  | `OAuth 2.0 PKCE`             |
| Version    | `v2.1.0`                     |

**Connects to:** API Gateway, CDN, Load Balancer, DNS, Firewall

## Connection rules

Connections are validated at the component-type level. The **connectsTo** list for each component type defines which outgoing connections are allowed. For example, a Service can connect to a Database, but a Database cannot connect to a Client.

At the technology level, some pairs are explicitly blocked. For example, Cloudflare Workers cannot connect to PostgreSQL (no TCP socket support). See the [Architecture](architecture.md) docs for details on the connection mapping system.
