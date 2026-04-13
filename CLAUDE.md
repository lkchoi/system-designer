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
