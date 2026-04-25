# System Designer

An interactive system architecture designer built with React, TypeScript, and [React Flow](https://reactflow.dev). Design distributed systems on a visual canvas, define component configurations, simulate failure scenarios, and analyze cost.

## Features

### Canvas

- Drag-and-drop 18 built-in component types (databases, services, API gateways, caches, message queues, and more) onto an infinite canvas
- Connect components with labeled edges specifying protocol (HTTP, gRPC, WebSocket, etc.) and data format (JSON, Protobuf, etc.)
- Connection validation enforces architectural constraints (e.g., API gateway cannot connect directly to a database)
- Sticky notes and text annotations for documentation
- Resizable nodes, double-click node labels to rename inline, editable edge labels, collapsible sidebar
- Drag-and-drop 12 built-in architectural patterns (Cache-Aside, CQRS, Pub/Sub Fanout, Saga, etc.) as pre-wired subgraphs
- Undo/redo for all canvas and node edits (Cmd+Z / Cmd+Shift+Z)

### Modes

**Plan** — Configure each component's technology, plan fields, sharding, API gateway endpoints, and resource links (label + URL pairs for dashboards, runbooks, repos). Technology selection shows throughput, limits, and provider info.

**Stress** — Simulate CAP theorem tradeoffs. Set each node's CAP classification (CP/AP/CA), then click nodes to simulate failures (healthy/overloaded/down) and click edges to simulate network partitions. Cascading effects propagate through the dependency graph automatically.

**Monitor** — Set node status (healthy/warning/error/idle) and view metrics (CPU, memory, requests/sec, latency).

**Price** — Analyze cost based on selected technologies and capacity.

### Tools

14 context-aware tools accessible from the properties panel (relevant tools shown per component type) or via hotkeys:

- **Capacity Calculator** (hotkey `C`) — Back-of-the-envelope scale estimations: TPS, payload size, replication, read/write ratio, retention. Computes data volumes, bandwidth, storage projections, and DynamoDB WCU/RCU. Includes a reference tab with searchable constants and technology throughput/limits.
- **Cron Translator** (hotkey `R`) — Human-readable cron expression interpreter
- **SLA Calculator** — Composite SLA computation for multi-service chains
- **Cache Sizer** — Memory and eviction estimates for cache nodes
- **JWT Inspector** — Decode and inspect JWT tokens
- **Partition Calculator** — Partition count and consumer group sizing for queues/streams
- **Connection Pool Sizer** — Optimal pool size for database/cache connections
- **Serverless Cost Estimator** — Lambda/Cloud Functions cost projections
- **Storage Growth Projector** — Storage capacity forecasting over time
- **Replication Planner** — Replica count and consistency tradeoffs
- **Latency Budget Calculator** — End-to-end latency budget allocation across hops
- **DNS TTL Advisor** — TTL recommendations based on change frequency
- **Payload Size Estimator** — Request/response payload size estimation
- **Regex Tester** — Live regex pattern testing and matching

### Flow Paths

Build named sequences of nodes to document request flows (e.g., "Post a comment": Client -> API Gateway -> Comment Service -> Database). Save with name and description, load from the sidebar.

### Import / Export

Export designs to multiple formats via Cmd+E:

- **Diagram** — Native JSON, Excalidraw
- **Infrastructure as Code** — AWS CloudFormation, AWS CDK, Terraform (`.tf.json`), Kubernetes manifests, Docker Compose, Nomad, Pulumi, LocalStack
- **API** — OpenAPI 3.0 spec (from API Gateway endpoints)

Import from Native JSON, Excalidraw, CloudFormation, Terraform, and Kubernetes via Cmd+I.

Docker Compose export maps component technologies to pinned container images:

| Category      | Image                           |
| ------------- | ------------------------------- |
| PostgreSQL    | `postgres:17-alpine`            |
| MySQL         | `mysql:9`                       |
| MongoDB       | `mongo:8`                       |
| Redis         | `redis:8-alpine`                |
| Kafka         | `confluentinc/cp-kafka:7.9.0`   |
| RabbitMQ      | `rabbitmq:4-management-alpine`  |
| Node.js       | `node:22-alpine` (LTS)          |
| Go            | `golang:1.24-alpine`            |
| Python        | `python:3.13-slim`              |
| Java          | `eclipse-temurin:21-jre-alpine` |
| Nginx         | `nginx:1.27-alpine`             |
| Elasticsearch | `elasticsearch:8.17.4`          |

Node descriptions are exported as comments (YAML `#`, TypeScript `//`, K8s annotations).

### Persistence

Designs are automatically saved to SQLite via the browser's Origin Private File System (OPFS). Save, load, and manage multiple designs without a backend.

### Extensible Component Registry

All component types are defined in a single registry (`src/registry/`). Each entry includes visual definition, plan fields, technology options, and connection compatibility rules. Adding a new component type requires one entry in `builtin-entries.ts`. The registry supports custom user-defined types via `registry.register()`.

## Develop

### Prerequisites

- [Bun](https://bun.sh/)
- [mkcert](https://github.com/FiloSottile/mkcert) for local HTTPS

### Setup

```bash
bun install

# Install mkcert's local CA into your system trust store (one-time)
mkcert -install

# Generate certificates for localhost
mkdir -p .certs
mkcert -key-file .certs/key.pem -cert-file .certs/cert.pem localhost 127.0.0.1 ::1
```

### Run

```bash
bun run dev
```

The dev server starts at `https://localhost:5173` with a trusted certificate (no browser warnings).

## Tech Stack

- **React 19** + **TypeScript 6**
- **React Flow** (@xyflow/react) for the graph canvas
- **Tailwind CSS 4** for styling
- **sql.js** + OPFS for client-side persistence
- **Vite 8** for dev server and build
- **Vitest** for testing
- **ULID** for unique IDs

## Pricing Data

Technology pricing for 86 services is maintained in `src/registry/pricing.ts`, generated by modular fetch scripts under `scripts/pricing/`.

### Updating prices

```bash
bun run pricing:fetch              # run all fetchers, regenerate pricing.ts
bun run pricing:list               # list fetchers and technology counts
bunx tsx scripts/pricing/run.ts --only aws,azure   # run specific fetchers
bunx tsx scripts/pricing/run.ts --dry-run           # fetch without overwriting
```

### Fetcher modules

| Module             | Technologies | Source                                         |
| ------------------ | ------------ | ---------------------------------------------- |
| `aws.ts`           | 27           | AWS Bulk Pricing API (live)                    |
| `azure.ts`         | 11           | Azure Retail Prices API (live)                 |
| `gcp.ts`           | 13           | GCP pricing calculator (live)                  |
| `cloudflare.ts`    | 6            | Static reference data                          |
| `databases.ts`     | 8            | Static (MongoDB, CockroachDB, Neo4j, etc.)     |
| `data-services.ts` | 16           | Static (Kafka, Snowflake, Elasticsearch, etc.) |
| `platforms.ts`     | 16           | Static (Kong, Vercel, Temporal, etc.)          |
| `open-source.ts`   | 39           | Static (frameworks, self-hosted tools)         |

Cloud provider fetchers pull live prices from public APIs and fall back to static data on failure. Static fetchers include vendor pricing page URLs for manual verification.

## Roadmap

### Data-connected editor tools
Purpose-built editors for specific component types that read and write node data:

1. **API Spec Editor** — Full OAS3 editor for API Gateway endpoints (path tree, request/response body schemas, headers, live YAML preview)
2. **Schema Designer** — Visual table editor for SQL databases with ER diagram (ReactFlow custom table nodes, per-column FK edge handles)
3. **Data Modeler** — NoSQL data modeler for DynamoDB/MongoDB (partition keys, sort keys, GSIs, access patterns)
4. **Queue Topology Designer** — Topic/queue definitions for Kafka/RabbitMQ (partitions, consumer groups, DLQs, message schemas)

Architecture: React Router (browser history) with routes at `/design/:designId/tools/:toolId/:nodeId`. Each editor lazy-loaded for code splitting. Load/save node data on open/close.

### Zustand state migration
Migrate Canvas state (`nodes`, `edges`, `viewport`) from `useState` to a Zustand store. Enables real-time sync between canvas and routed editor tools via selector-based subscriptions, and eliminates prop drilling.

## Project Structure

```
src/
  App.tsx              Main canvas, mode system, state management
  stressEngine.ts      Pure function computing cascading failure effects
  types.ts             Shared TypeScript interfaces
  data.ts              Utility functions (randomMetrics, displayType)
  technologies.ts      Shared technology base data (name, providers)
  hotkeys.ts           Hotkey definitions (key, modifiers, category)
  registry/
    builtin-entries.ts   18 component type definitions
    ComponentRegistry.ts Registry class (get, canConnect, register)
    pricing.ts           Technology pricing data (auto-generated)
    index.ts             Public registry exports
    types.ts             Registry interfaces
  patterns/
    builtin-patterns.ts  12 pre-wired architectural patterns
    instantiate.ts       Expand a pattern into nodes/edges at a position
    index.ts, types.ts   Public exports and interfaces
  connections/
    component-rules.ts  ~65 component-to-component connection defaults
    tech-rules.ts        ~60 technology-to-technology overrides
    index.ts             Lookup API (resolveConnection, validateTechConnection, etc.)
  utils/
    capacity.ts          Capacity calculator logic and formatters
    keyboard.ts          Keyboard utilities
  converters/
    types.ts             Converter interface (FormatId, ExportResult)
    index.ts             Converter registry and helpers
    iac-mapping.ts       (componentType, tech) → resource/image mapping
    detect.ts            Import format auto-detection
    native-json.ts       Native design JSON converter
    excalidraw.ts        Excalidraw JSON converter
    cloudformation.ts    AWS CloudFormation (YAML/JSON)
    terraform.ts         Terraform .tf.json
    kubernetes.ts        K8s manifests (YAML)
    docker-compose.ts    Docker Compose (YAML) with scaffold code generation
    aws-cdk.ts           AWS CDK TypeScript
    pulumi.ts            Pulumi TypeScript
    nomad.ts             Nomad JSON job spec
    localstack.ts        LocalStack (CFn + compose)
    openapi.ts           OpenAPI 3.0 spec
    bundle.ts            Local-deploy bundle (compose + scaffold + CLAUDE.md)
    scaffold/            Code generation for scaffolded services
      go.ts, node.ts, python.ts   Language templates
      concerns/          Client/runtime concern composition
  db/
    database.ts          sql.js database initialization (OPFS, lazy-loaded)
    designs.ts           Design CRUD operations
    schema.ts            SQLite table definitions
    io.ts                Export/import serialization helpers
    index.ts             Public db exports
  components/
    SystemNode.tsx       System component node
    ContainerNode.tsx    Group container (always renders below system nodes)
    CompareView.tsx      Side-by-side design comparison (lazy-loaded)
    PropertiesPanel.tsx  Node properties (mode-aware, incl. resource links)
    EdgePropertiesPanel.tsx  Edge properties
    ExportDialog.tsx     Multi-format export dialog (lazy-loaded)
    HotkeyHelpOverlay.tsx   Keyboard shortcut reference
    LabeledEdge.tsx      Custom edge with labels and tags
    Sidebar.tsx          Draggable components, patterns, and saved paths
    StickyNote.tsx       Sticky note annotations
    TextNode.tsx         Text labels
  tools/
    index.ts             Tool registry with lazy-loaded components
    types.ts             ToolDef interface
    ToolLauncher.tsx     Context-aware tool launcher for properties panel
    capacity-calculator/ Capacity Calculator
    cron-translator/     Cron Translator
    sla-calculator/      SLA Calculator
    cache-sizer/         Cache Sizer
    jwt-inspector/       JWT Inspector
    partition-calculator/      Partition Calculator
    connection-pool-sizer/     Connection Pool Sizer
    serverless-cost-estimator/ Serverless Cost Estimator
    storage-growth-projector/  Storage Growth Projector
    replication-planner/       Replication Planner
    latency-budget-calculator/ Latency Budget Calculator
    dns-ttl-advisor/           DNS TTL Advisor
    payload-size-estimator/    Payload Size Estimator
    regex-tester/              Regex Tester
  hooks/
    useHotkeys.ts        Keyboard shortcut system
    useUndoRedo.ts       Undo/redo state management
    usePricing.ts        Lazy-loading hook for pricing data
scripts/
  pricing/
    run.ts               CLI entry point — orchestrates fetchers
    generate.ts          Combines results into src/registry/pricing.ts
    types.ts             Shared script types
    utils.ts             HTTP helpers, retry, pagination
    fetchers/            One module per provider/source (see table above)
```
