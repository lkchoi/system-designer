# Architectural Patterns

12 pre-wired architectural patterns are available in the sidebar's **Patterns** tab. Drag a pattern onto the canvas to place all its nodes and edges at once.

## Patterns

### Cache-Aside

Service checks cache before hitting database. On cache miss, the service queries the database and populates the cache for subsequent reads.

| Nodes | Edges |
|-------|-------|
| Service, Cache, Database | Service -> Cache (check), Service -> Database (fallback) |

### CQRS

Separate command and query paths with event sync. Write operations go through a command service to a write database; events are published to a message queue that syncs a read-optimized database for the query service.

| Nodes | Edges |
|-------|-------|
| API Gateway, Command Service, Write DB, Message Queue, Query Service, Read DB | Gateway -> Command (commands), Gateway -> Query (queries), Command -> Write DB (write), Command -> MQ (events), MQ -> Query (sync), Query -> Read DB (read) |

### Pub/Sub Fanout

One producer fans out to multiple consumers via a message queue. Each consumer receives a copy of every message.

| Nodes | Edges |
|-------|-------|
| Producer (Service), Message Queue, Consumer 1, Consumer 2, Consumer 3 | Producer -> MQ (publish), MQ -> each Consumer (subscribe) |

### Load-Balanced API

Load balancer distributes traffic across service replicas, all backed by a shared database.

| Nodes | Edges |
|-------|-------|
| Load Balancer, Service x3, Database | LB -> each Service, each Service -> Database |

### CDN + Origin

DNS routes to a CDN backed by object storage. Static assets are served from edge locations with origin pulls to the storage backend.

| Nodes | Edges |
|-------|-------|
| DNS, CDN, Storage | DNS -> CDN (resolve), CDN -> Storage (origin pull) |

### Auth Gateway

API gateway authenticates requests via a dedicated auth service before forwarding to the backend.

| Nodes | Edges |
|-------|-------|
| API Gateway, Auth Service, Database, Backend Service | Gateway -> Auth (authenticate), Auth -> Database (verify), Gateway -> Backend (forward) |

### Event Sourcing

Service emits events to a stream processor, which materializes views in both a database and a search engine.

| Nodes | Edges |
|-------|-------|
| Service, Stream Processor, Database, Search Engine | Service -> Stream (events), Stream -> Database (store), Stream -> Search (index) |

### Microservice + Sidecar

API gateway routes to a service backed by cache, database, and message queue — a common microservice topology.

| Nodes | Edges |
|-------|-------|
| API Gateway, Service, Cache, Database, Message Queue | Gateway -> Service (route), Service -> Cache (cache), Service -> Database (persist), Service -> MQ (emit) |

### Client Full Stack

End-to-end client request path through DNS resolution, load balancing, service processing, and database persistence.

| Nodes | Edges |
|-------|-------|
| Client, DNS, Load Balancer, Service, Database | Client -> DNS (resolve), DNS -> LB, LB -> Service, Service -> Database |

### ETL Pipeline

Cron-triggered serverless function extracts data from a source database and loads it into a data warehouse.

| Nodes | Edges |
|-------|-------|
| Cron, Serverless, Source Database, Data Warehouse | Cron -> Serverless (trigger), Serverless -> Source DB (extract), Serverless -> Warehouse (load) |

### Change Data Capture

Stream processor captures database change logs and replicates them to a target database and search engine for downstream sync.

| Nodes | Edges |
|-------|-------|
| Source Database, Stream Processor, Target Database, Search Engine | Source DB -> Stream (change log), Stream -> Target DB (replicate), Stream -> Search (index) |

### Rate Limiter

API gateway enforces rate limits by checking a cache (token bucket / sliding window) before forwarding requests to the backend service.

| Nodes | Edges |
|-------|-------|
| Client, API Gateway, Cache, Service | Client -> Gateway (request), Gateway -> Cache (check limit), Gateway -> Service (forward) |
