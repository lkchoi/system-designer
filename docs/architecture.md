# Architecture

Arkon is a pure frontend SPA — no backend, no API, no server. All data lives in the browser via SQLite (OPFS). The app is deployed as static files to Cloudflare Pages.

## System overview

```
Canvas (React Flow)
  |
  v
State (useState / useCallback)
  |
  +---> Modes (Plan, Stress, Monitor, Price)
  |       |
  |       v
  |     Properties Panel ──> Tools (lazy-loaded)
  |
  +---> Converters (11 formats)
  |       |
  |       +---> IaC Mapping (componentType + tech -> resource)
  |       +---> Connection Mapping (edge metadata + validation)
  |       +---> Scaffold Concerns (code generation)
  |       +---> Wiring (env vars from edges)
  |
  +---> DB (SQLite via sql.js + OPFS)
          |
          +---> Designs CRUD
          +---> Auto-save on change
```

## Four core systems

### 1. Component Registry (`src/registry/`)

Single source of truth for all component types. Each entry defines:

- **Visual identity** — label, color, SVG icon path
- **Category** — compute, data, networking, messaging, scheduling, storage, client
- **Plan fields** — configurable fields shown in Plan mode (key, label, type, placeholder)
- **Technologies** — available technology choices with throughput, limits, vendor info
- **Connection rules** — `connectsTo` array of valid outgoing connection targets

The registry is extensible at runtime via `registry.register()` for custom component types.

**Key files:**
- `src/registry/builtin-entries.ts` — 18 built-in type definitions
- `src/registry/ComponentRegistry.ts` — Registry class with `get()`, `canConnect()`, `register()`
- `src/registry/pricing.ts` — Auto-generated pricing data for 86 technologies

### 2. Connection Mapping (`src/connections/`)

Two-layer system that enriches edges with metadata and validates technology-level compatibility.

**Layer 1 — Component rules** (`component-rules.ts`): ~65 entries mapping `(source, target)` component type pairs to default protocol, format, edge label, and commonality score.

**Layer 2 — Tech rules** (`tech-rules.ts`): ~60 entries mapping `(sourceTech, targetTech)` pairs to protocol overrides, environment variable templates, IaC metadata (IAM actions, CDK grants, security group ports), and blocked pair declarations.

**Lookup API** (`index.ts`):
- `resolveConnection()` — merge component defaults with tech overrides
- `validateTechConnection()` — check if a tech pair is blocked
- `getRecommendedTargets()` — ranked connection suggestions
- `getIaCMetadata()` — IAM actions, CDK grants for a tech pair
- `getEnvVarTemplate()` — env var templates with `{HOST}`, `{PORT}` tokens

**Blocked pairs example:** Cloudflare Workers -> PostgreSQL is blocked because Workers lack TCP socket support. The system suggests alternatives (Neon HTTP driver, Hyperdrive).

### 3. Converters (`src/converters/`)

Pluggable export/import system. Each converter implements the `ConverterModule` interface:

```typescript
interface ConverterModule {
  id: FormatId;
  label: string;
  description: string;
  category: "diagram" | "iac" | "api";
  fileExtensions: string[];
  canImport: boolean;
  exportDesign(design: DesignJSON, options?: ExportOptions): ExportResult | Promise<ExportResult>;
  importDesign?(content: string): DesignJSON;     // only if canImport
}
```

**IaC mapping** (`iac-mapping.ts`): Maps `(componentType, technologyId)` to infrastructure resources across all IaC formats — CloudFormation resource types, Terraform resource types, Kubernetes kinds, Docker images, CDK constructs, and Pulumi resources. ~70 entries covering databases, caches, queues, storage, serverless, networking, compute, search, and warehouses. Includes reverse lookups (e.g., `cfnToComponentType()` for import).

**Key files:**
- `src/converters/types.ts` — `ConverterModule`, `ExportResult` interfaces
- `src/converters/index.ts` — Converter registry, format detection
- `src/converters/iac-mapping.ts` — (componentType, tech) -> resource mapping
- `src/converters/detect.ts` — Auto-detection of import format from file contents

### 4. Scaffold Concerns (`src/converters/scaffold/concerns/`)

Code generation system that produces working application code for scaffolded services. Based on three-axis composition:

```
Scaffold = Runtime x Client[] x Language
```

**Client concerns** (`concerns/clients/`): One file per target technology (redis, postgresql, kafka, etc.). Each defines a `LangSnippet` per language (Go, Node.js, Python) with:
- `deps` — package dependencies
- `imports` — language-native import statements
- `globals` — top-level variable declarations (client instances)
- `init` — startup code (connection establishment)
- `shutdown` — graceful cleanup code
- `healthChecks` — expressions that verify the connection is alive

**Runtime concerns** (`concerns/runtimes/`): Define the program's entrypoint shape. Currently: `http-server` (default) and `lambda` (AWS Lambda).

**Merge engine** (`concerns/merge.ts`): Combines multiple `LangSnippet` objects into `MergedSlots` — deps are merged (last wins), imports are deduplicated, all other arrays are concatenated in order.

**Resolution** (`concerns/resolve.ts`): Maps a service's outgoing edges to client concerns by `targetTechId`. Deduplicates by tech (two Redis edges produce one concern).

**Language templates** (`go.ts`, `node.ts`, `python.ts`): Render `MergedSlots` into final source files. Each template defines where slots are injected: deps into dependency files, imports into the import block, globals after imports, init into startup, shutdown into signal handlers, health checks into the `/health` endpoint.

**Data flow:**
```
Design edges
  -> docker-compose.ts builds ConnectionInfo[] (calls resolveTechId)
  -> scaffoldService() calls resolveConcerns(lang, connections)
  -> resolve.ts maps each connection to a ClientConcern
  -> merge.ts combines all LangSnippets into MergedSlots
  -> Language template renders slots into Dockerfile + source + tests
```

## Supporting systems

### Database (`src/db/`)

SQLite via sql.js compiled to WebAssembly. Data is persisted to the browser's Origin Private File System (OPFS). The database is lazy-loaded on first access.

- `database.ts` — initialization, OPFS read/write
- `designs.ts` — CRUD operations for designs
- `schema.ts` — table definitions
- `io.ts` — serialization helpers for export/import

### Stress Engine (`src/stressEngine.ts`)

Pure function that computes cascading failure effects. Given node statuses, edge states, and CAP classifications, propagates failures through the dependency graph. Handles:

- Direct failures (node overloaded/down)
- Network partitions (edge severed)
- CAP-aware behavior (CP nodes refuse writes during partition, AP nodes return stale data)
- Cascade propagation (dependent services degrade)

### Tools (`src/tools/`)

Each tool is a self-contained directory with a React component, business logic, and tests. Tools are registered in `src/tools/index.ts` with metadata including `appliesTo` (which component types show this tool) and optional hotkeys. Components are lazy-loaded.

### Patterns (`src/patterns/`)

12 built-in architectural patterns. Each pattern is a declarative template defining nodes (with component types and relative positions) and edges (with optional labels). `instantiate.ts` expands a pattern into real nodes and edges at the cursor position, generating unique IDs and absolute positions.

## Tech stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, TypeScript 6 |
| Canvas | React Flow (@xyflow/react) |
| Styling | Tailwind CSS 4 |
| Persistence | sql.js (SQLite WASM) + OPFS |
| Build | Vite 8 |
| Test | Vitest |
| Lint | oxlint |
| Format | oxfmt |
| Deploy | Cloudflare Pages (wrangler) |
