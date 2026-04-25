# Tools Reference

14 context-aware tools accessible from the properties panel or via keyboard shortcuts. The properties panel shows only tools relevant to the selected component type.

## Capacity Calculator

**Hotkey:** `C` | **Applies to:** Database, Cache, Message Queue, Storage, Stream Processor, Data Warehouse, CDN

Back-of-the-envelope scale estimation. Enter TPS, payload size, replication factor, read/write ratio, and retention period. Computes:

- Data volume per day/month/year
- Bandwidth requirements
- Storage projections
- DynamoDB WCU/RCU estimates

Includes a reference tab with searchable constants (byte sizes, common limits) and technology throughput/limits from the registry.

## Cron Translator

**Hotkey:** `R` | **Applies to:** Cron, Serverless

Bidirectional cron expression translator. Enter a cron expression to see the human-readable schedule, or describe a schedule in plain English to generate the cron expression. Shows next N fire times.

## SLA Calculator

**Applies to:** All component types

Composite SLA computation for multi-service chains. Enter individual service SLAs and the calculator shows the combined availability for serial and parallel configurations. Useful for understanding how component SLAs compound across a request path.

## Cache Sizer

**Applies to:** Cache

Memory and eviction estimation. Enter key count, average value size, and TTL to compute total memory requirements. Factors in overhead per key and shows eviction pressure at different cache sizes.

## JWT Inspector

**Applies to:** API Gateway, Firewall

Paste a JWT token to decode and inspect its header, payload, and signature. Shows expiration time, issuer, claims, and algorithm. Does not validate signatures (no secret needed).

## Partition Calculator

**Applies to:** Message Queue, Stream Processor

Partition count and consumer group sizing. Enter message throughput, consumer processing rate, and ordering requirements to compute optimal partition count, consumer group size, and rebalancing impact.

## Connection Pool Sizer

**Applies to:** Database, Cache

Optimal connection pool size calculation. Enter concurrent requests, query duration, and connection overhead to compute min/max pool sizes. Accounts for connection creation cost and idle timeout.

## Serverless Cost Estimator

**Applies to:** Serverless

Lambda/Cloud Functions cost projection. Enter invocation count, average duration, memory allocation, and compute pricing to estimate monthly cost. Includes free tier deductions.

## Storage Growth Projector

**Applies to:** Storage, Data Warehouse

Storage capacity forecasting over time. Enter current size, daily growth rate, and compression ratio to project storage needs at 30/90/180/365 day horizons.

## Replication Planner

**Applies to:** Database, Cache, Message Queue

Replica count and consistency tradeoff analysis. Enter data size, read/write ratio, and consistency requirements to determine replica count, replication lag estimates, and consistency level recommendations.

## Latency Budget Calculator

**Applies to:** API Gateway, Load Balancer, CDN

End-to-end latency budget allocation across request hops. Enter total budget (e.g., 200ms) and allocate portions to each hop in the request path. Highlights when the budget is exceeded.

## DNS TTL Advisor

**Applies to:** DNS

TTL recommendations based on change frequency and failover requirements. Enter how often records change, whether you need fast failover, and current TTL to get recommendations.

## Payload Size Estimator

**Applies to:** API Gateway, Message Queue, Webhook

Request/response payload size estimation. Define fields with types and cardinalities to estimate serialized sizes in JSON, Protobuf, and MessagePack formats.

## Regex Tester

**Applies to:** API Gateway, Firewall

Live regex pattern testing. Enter a pattern and test strings to see matches, capture groups, and performance characteristics.
