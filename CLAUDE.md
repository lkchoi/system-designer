# System Designer

React + TypeScript system architecture designer built on ReactFlow.

## Workflow

- Commit after completing each task. Do not batch multiple tasks into one commit.
- Run `npx tsc --noEmit` to verify the build before committing.

## Architecture

- `src/registry/` — single source of truth for all component types (visuals, plan fields, technologies, connection compatibility)
- `src/data.ts` — utility functions only (`randomMetrics`, `displayType`)
- `src/components/` — React components for nodes, edges, panels
- `src/types.ts` — shared TypeScript interfaces

To add a new component type, add one entry to `src/registry/builtin-entries.ts`.

## Connection Mapping + Scaffold Concerns

Two subsystems that work together: **connections/** declares *what* connects to what, **scaffold/concerns/** declares *how* to generate code for each connection.

### Data flow

```
design edges
  → docker-compose.ts builds ConnectionInfo[] per scaffolded service
  → scaffold/index.ts calls resolveConcerns(lang, connections)
    → clients/index.ts looks up ClientConcern per targetTechId (with alias fallback)
    → merge.ts combines LangSnippets into MergedSlots
  → language template (go.ts / node.ts / python.ts) renders MergedSlots into source
```

### `src/connections/` — what connects to what

Two-layer resolution:

- **Layer 1** (`component-rules.ts`): ~65 component-to-component defaults — protocol, format, edge label, commonality score. Used for edge auto-suggestion and connection recommendations.
- **Layer 2** (`tech-rules.ts`): ~60 technology-to-technology overrides — env var templates, IAM actions, CDK/Pulumi grants, security group ports, blocked pairs. `sourceTech: "*"` means any compute runtime.
- **Lookup API** (`index.ts`): `resolveConnection()`, `validateTechConnection()`, `getRecommendedTargets()`, `getIaCMetadata()`, `getEnvVarTemplate()`.

### `src/converters/scaffold/concerns/` — how to generate code

Three-axis composition: **Runtime** × **Client[]** × **Language**.

- **Client concerns** (`clients/*.ts`): one file per target tech (redis, postgresql, kafka, etc.). Each exports a `ClientConcern` with per-language `LangSnippet` containing deps, imports, globals, init, shutdown, healthChecks.
- **Runtime concerns** (`runtimes/*.ts`): entrypoint patterns (http-server, lambda).
- **Merge** (`merge.ts`): combines multiple `LangSnippet`s into `MergedSlots`. Deduplicates imports, merges deps.
- **Resolve** (`resolve.ts`): maps `ConnectionInfo[]` → `MergedSlots` by looking up client concerns.

### How to add a new client concern

1. Create `src/converters/scaffold/concerns/clients/<tech>.ts` exporting a `ClientConcern` with `node`, `python`, `go` snippets.
2. Import and add it to `CLIENT_CONCERNS` in `clients/index.ts`.
3. Go init blocks must use `{ }` block scoping to avoid `err` redeclaration when multiple concerns are merged.

### How to add a tech alias

Add one line to `TECH_ALIASES` in `clients/index.ts` (e.g., `tidb: "mysql"`).

### What's wired vs. deferred

| Feature | Status |
|---------|--------|
| Scaffold SDK injection (docker-compose export) | Wired |
| Edge auto-suggestion (App.tsx onConnect) | Data exists, not wired |
| Tech-level validation (App.tsx isValidConnection) | Data exists, not wired |
| Connection recommendations (sidebar) | Data exists, not wired |
| IaC connection generation (IAM/SG in CFn/CDK/TF/K8s) | Data exists, not wired |
| Runtime concern merging (lambda entrypoint) | Data exists, not wired |
