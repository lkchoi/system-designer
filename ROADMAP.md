# Roadmap

## Data-connected editor tools

The app has 16 utility tools (calculators, estimators, reference aids) that are stateless. The next step is purpose-built editors tied to specific component types that let users define the actual artifacts of their system — API specs, database schemas, queue topologies — and feed those into exports.

### Architecture

- **Routing:** React Router (browser history), routes at `/design/:designId/tools/:toolId/:nodeId`
- **Data flow:** Load node data from SQLite on open, save on close. Each editor is a full-page view.
- **Code splitting:** Each editor is `React.lazy()` imported
- **ToolDef extension:** Add `category: "utility" | "editor"` and `route` field. Editor tools render as "Open editor" links in the properties panel instead of modal buttons.

### Prerequisites

1. Add `react-router-dom` (browser history mode)
2. Wrap app in `<BrowserRouter>`, move Canvas to `/` route
3. Extend `ToolDef` with `category` and `route` fields
4. Update `ToolLauncher` to render editor links vs. modal buttons
5. Create `useNodeData(designId, nodeId)` hook for load/save

### Editor tools — priority order

#### 1. API Spec Editor

Full OAS3 editor for API Gateway nodes. Path tree, per-operation request/response body schemas (JSON Schema), headers, auth requirements, live YAML preview.

- **Applies to:** api-gateway
- **Route:** `/design/:designId/tools/api-spec/:nodeId`
- **Data model:** Extends existing `Endpoint` with `requestBody`, `responseSchemas`, `headers`, `pathParams`
- **Export integration:** Feeds `buildOpenApiYaml()` — turns the OAS3 export from a path list into a production-grade spec

**Why it matters:** API contracts are the primary interface between services. Defining them at design time enables spec-driven scaffolding, frontend mocking, and contract testing from day one.

#### 2. Schema Designer

Visual table editor for SQL databases with ER diagram view. Define tables, columns (name, type, nullable, default), primary keys, foreign keys, indexes, unique constraints.

- **Applies to:** database (postgresql, mysql, mariadb, cockroachdb, tidb)
- **Route:** `/design/:designId/tools/schema/:nodeId`
- **Data model:** New `SystemNodeData.schema` field with `tables[]`, each containing `columns[]` with type, constraints, and FK references
- **ER diagram:** ReactFlow canvas with custom table nodes. Per-column source/target handles so FK edges connect specific columns (e.g., `users.org_id → orgs.id`)
- **Export integration:** Replaces placeholder SQL stubs in `init-scripts.ts` with real DDL. Could generate ORM models (Drizzle, Prisma, TypeORM).

**Why it matters:** The database schema is the foundation of most systems. Defining it at design time means the Docker Compose bundle generates real `init/schema.sql`, and scaffolded services can generate typed data access code.

#### 3. Data Modeler

NoSQL data modeler for DynamoDB, MongoDB, Cassandra, ScyllaDB. Define collections/tables with partition keys, sort keys, GSIs/LSIs, indexes, and access patterns.

- **Applies to:** database (dynamodb, mongodb, cassandra, scylladb)
- **Route:** `/design/:designId/tools/data-model/:nodeId`
- **Data model:** New `SystemNodeData.dataModel` with technology-specific sub-types
- **Export integration:** CloudFormation/Terraform table definitions, seed scripts

**Why it matters:** NoSQL schemas are designed around access patterns, not normalized relations. Getting the key design wrong is expensive to fix in production. This tool forces the right thinking at design time — partition key + sort key + GSI design for DynamoDB, index strategy and embedding vs. referencing for MongoDB.

#### 4. Queue Topology Designer

Topic/queue designer for Kafka, RabbitMQ, SQS, Pub/Sub. Define partitions, consumer groups, dead-letter queues, retention policies, and message schemas (JSON Schema / Avro).

- **Applies to:** message-queue, stream-processor
- **Route:** `/design/:designId/tools/queue-topo/:nodeId`
- **Data model:** New `SystemNodeData.topology` with `topics[]`, each containing partition count, replication, retention, DLQ reference, and message schema
- **Export integration:** Init scripts for Kafka topic creation, RabbitMQ queue/exchange declarations

**Why it matters:** Message-driven architectures fail at the seams — wrong partition counts, missing DLQs, schema evolution surprises. Defining topology at design time makes these decisions explicit and feeds them into the infrastructure export.

### Future editor tools (lower priority)

| Tool                               | Component type        | Purpose                                                                               |
| ---------------------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| Cache Strategy Editor              | cache                 | Key patterns, TTL policies, eviction strategies, invalidation triggers                |
| CDN Rules Editor                   | cdn, load-balancer    | Routing rules, cache headers, origin failover, rate limits                            |
| IAM Policy Builder                 | serverless, storage   | Roles, policies, least-privilege permissions                                          |
| Rate Limiter Calculator            | api-gateway, firewall | Token bucket / sliding window config from QPS + burst tolerance                       |
| Cache Invalidation Strategy Picker | cache                 | Decision tree: write-through vs write-behind vs cache-aside based on read/write ratio |

---

## Zustand state migration

Migrate Canvas state (`nodes`, `edges`, `viewport`) from `useState` in the `Canvas` component to a Zustand store.

### What it enables

- **Real-time sync** between canvas and routed editor tools via selector-based subscriptions (`useSyncExternalStore`). Currently, editor tools are full-page views that load/save on open/close — Zustand would allow split-screen or side-panel editors that coexist with the canvas.
- **Prop drilling elimination.** The `onUpdate` callback currently threads through `App → Canvas → PropertiesPanel → endpoint editor`. With Zustand, any component calls `useDesignStore(s => s.updateNodeData)` directly.
- **Efficient re-renders.** Selector-based subscriptions mean only the changed node re-renders, not the entire canvas.

### When to do this

Not needed for the initial editor tools (they navigate away from the canvas). Becomes valuable if we later want editors that coexist with the canvas in a split view.

---

## Collaborative editing

Real-time multiplayer editing using Yjs CRDTs. In-progress on a separate branch.

### What exists

- **Y.Doc schema** — nodes and edges stored as nested `Y.Map` structures with flattened dot-notation keys
- **Bidirectional sync** — React state diffs applied to Y.Doc (`syncNodesToYMap`), Y.Doc changes materialized back to React (`materializeNodes`)
- **y-websocket server** — Node.js server with file-based Y.Doc persistence, room management
- **Awareness** — cursor presence via `y-protocols/awareness`
- **Undo/redo** — Yjs `UndoManager` tracking local-origin changes

### Remaining work

- **Incremental diff** — `syncNodesToYMap` iterates all nodes on every sync. Should skip unchanged nodes using React's reference equality (`prevNode === nextNode`)
- **Incremental materialization** — `materializeNodes` rebuilds the entire array on every remote change. Should patch only the changed node
- **Web Worker** — all sync/materialize runs on the main thread. Large diffs (100+ nodes) block rendering
- **Persistence model** — Y.Doc becomes source of truth; local sqlite/OPFS becomes offline fallback. `wiring.ts` env var generation should be consolidated with `tech-rules.ts` templates before this lands
- **Auth and rooms** — room-per-design, user identity, permission model
- **Conflict resolution UI** — visual indicators when concurrent edits conflict

---

## Connection mapping activation

`src/connections/` has ~125 rules (65 component-level, 60 technology-level) and a full lookup API. Edge auto-suggestion is wired; four features remain.

| Feature                    | API                        | Integration point                                                                                                       |
| -------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Tech-level validation      | `validateTechConnection()` | `App.tsx` `isValidConnection` — block incompatible tech pairs (e.g., CF Workers → PostgreSQL) with reason tooltip       |
| Connection recommendations | `getRecommendedTargets()`  | Sidebar — suggest targets sorted by commonality when a component is added                                               |
| IaC enrichment             | `getIaCMetadata()`         | CloudFormation, CDK, Terraform, Pulumi exporters — emit IAM policies, security groups, CDK grants from tech-level rules |
| Runtime concern activation | `getRuntimeConcern()`      | `scaffold/concerns/resolve.ts` — merge Lambda runtime snippets into scaffold output                                     |

### wiring.ts consolidation

Env var generation is duplicated: `wiring.ts` has a hardcoded switch per technology, `tech-rules.ts` has tokenized templates (`{HOST}`, `{PORT}`). Consolidate so `wiring.ts` consumes the templates from `tech-rules.ts`, substituting tokens with resolved values from the design.

---

## Long-term vision

The gap between "draw an architecture" and "run an architecture" is the central problem. The sections above address the near-term (editor tools, state management, collaboration). Below are the deeper capabilities needed to make this a tool architects actually stay in.

### Design rationale and constraints

Designs capture _what_ but not _why_. An architect revisiting a diagram in six months sees boxes and arrows but no context for the decisions behind them. The tool needs a way to attach decision records to nodes and edges — "chose Kafka over SQS because we need ordering guarantees across 100K msg/s" — and surface them in context during reviews and exports.

Non-functional requirements (p99 < 200ms, 99.95% SLA, $X/month budget) should be first-class objects that the tool can validate against. The latency budget calculator, SLA calculator, and capacity calculator already exist as standalone utilities — connecting their outputs to stated constraints would close the loop between "what we designed" and "does it meet our requirements."

### System-level cost model

The serverless cost estimator covers one node type. Architects need "this entire architecture costs ~$X/month on AWS" with compute, storage, data transfer, and managed service fees aggregated across all nodes. This requires per-technology pricing data (already partially in the registry) and a cost rollup view in price mode that sums across the design.

### Request flow modeling

Flow paths are ordered node lists. Real request flows have branching (cache hit vs miss), async fan-out, retry loops, and error paths. Sequence diagram-level modeling — with request/response payloads, latency annotations, and failure scenarios — would make flow paths useful for API reviews, onboarding, and incident analysis.

### Deployable infrastructure export

Docker Compose exports run locally. The next level is generating Terraform, CloudFormation, or Pulumi that provisions the design on a real cloud account. The connection mapping layer (`tech-rules.ts`) already has IAM actions, security group ports, and CDK grants — these need to flow into actual IaC output, not stubs.

### Architecture drift detection

Once teams start building, the code diverges from the diagram immediately. Drift detection — comparing the design against live infrastructure (via cloud APIs or IaC state files) or against code (service discovery from repo structure) — would make the diagram a living document rather than a point-in-time snapshot.

### Observability integration

Monitor mode is simulated. Connecting to real observability backends (Datadog, Grafana, CloudWatch) would let the diagram reflect actual system health — node status from health checks, edge latency from traces, throughput from metrics. Stress mode could evolve from manual toggling to replaying real incidents or triggering chaos experiments.

### Security and compliance modeling

Firewall nodes exist but there's no way to model authentication flows, encryption boundaries, network segmentation, or compliance zones (PCI, HIPAA, SOC 2). Security modeling would let architects define trust boundaries and data classification, then validate that the design doesn't route sensitive data through unencrypted paths or store PII outside compliant regions.

### Team ownership and environment modeling

Real systems have organizational structure — service ownership, on-call rotation, repo mapping — and multiple environments (dev/staging/prod) with different instance counts, feature flags, and configurations. Modeling these would connect the architecture to the humans and processes around it.
