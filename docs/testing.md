# Testing

## Overview

Tests use **Vitest** and run via `bun run test` (single run) or `bun run test:watch` (watch mode). All tests are unit tests — no browser automation or E2E tests.

```bash
bun run test          # single run
bun run test:watch    # watch mode
bunx tsc --noEmit     # type check (no test execution)
```

## Test coverage

### Converters

| File | What it tests |
|------|--------------|
| `converters/docker-compose.test.ts` | Bundle generation: compose YAML structure, service entries, depends_on from edges, env var wiring (DATABASE_URL, REDIS_URL), secrets generation, init scripts (schema SQL, bucket creation), volume mounts, shell script executability, README content, excluded components, vendor-locked serverless handling, multi-line description comments |
| `converters/scaffold/scaffold.test.ts` | Scaffold output for Node.js, Go, Python: correct files produced, package deps, test file structure, health endpoint, endpoint stubs, connections → SDK injection |
| `converters/scaffold/concerns/concerns.test.ts` | Merge engine (deps merge, import dedup, array concat), concern resolution (redis+pg for node/go/python, dedup by techId, unknown tech → empty), client concern registry (all 10 techs registered with all 3 langs), integration tests (scaffoldService with connections → correct deps/imports in output) |
| `converters/cloudformation.test.ts` | CFn resource generation, DynamoDB attribute definitions, sharded key schemas |
| `converters/aws-cdk.test.ts` | CDK construct generation, module imports |
| `converters/pulumi.test.ts` | Pulumi resource generation |
| `converters/nomad.test.ts` | Nomad job spec structure, group/task/service generation |
| `converters/localstack.test.ts` | LocalStack compose + CFn template generation |
| `converters/claude-md.test.ts` | CLAUDE.md content generation for bundles |
| `converters/secrets.test.ts` | Secret generation, .env file content, container env vars |
| `converters/wiring.test.ts` | Edge → env var mapping, first-edge-wins, explicit overrides |
| `converters/init-scripts.test.ts` | Schema SQL, bucket scripts, topic scripts, Ofelia config |

### Connections

| File | What it tests |
|------|--------------|
| `connections/connections.test.ts` | Component defaults, tech rule lookup (wildcard vs specific), connection resolution (merge layers), blocked pairs (cf-workers), recommended targets (sorted by commonality), IaC metadata (IAM actions, CDK grants), env var templates, data integrity (no duplicates, commonality bounds, all blocked pairs have reasons) |

### Tools

| File | What it tests |
|------|--------------|
| `tools/capacity-calculator/capacity.test.ts` | Capacity math: storage projections, bandwidth, DynamoDB WCU/RCU |
| `tools/cron-translator/cron.test.ts` | Bidirectional cron parsing, next fire times, edge cases |
| `tools/sla-calculator/sla.test.ts` | Composite SLA computation |
| `tools/cache-sizer/cache-sizer.test.ts` | Memory estimation, eviction calculations |
| `tools/latency-budget-calculator/latency.test.ts` | Budget allocation, overflow detection |
| *(other tools)* | Pattern varies — some have test files, some rely on type checking |

### Registry

| File | What it tests |
|------|--------------|
| `registry/ComponentRegistry.test.ts` | Registry lookup, connection validation, custom type registration |

### Patterns

| File | What it tests |
|------|--------------|
| `patterns/patterns.test.ts` | Pattern instantiation, unique ID generation, position calculation |

## What's not tested

- **Browser rendering** — no E2E or component tests. UI correctness relies on manual verification.
- **OPFS persistence** — sql.js + OPFS integration isn't tested (requires browser environment).
- **Generated code compilation** — scaffold output is string-asserted, not compiled. A Go service with Redis + PostgreSQL connections would fail `go build` due to `err` redeclaration (known issue).
- **Import round-trips** — export → import → export fidelity is not systematically tested.
- **Canvas interactions** — drag-and-drop, connection drawing, undo/redo behavior.

## Manual test scenarios

When making changes, verify these golden paths manually:

### Canvas basics
1. Drag a Service and Database from sidebar onto canvas
2. Connect Service → Database (should succeed)
3. Try connecting Database → Client (should be blocked)
4. Double-click node label to rename
5. Undo the rename with Cmd+Z

### Plan mode
1. Press `1` to enter Plan mode
2. Click a Database node, select PostgreSQL
3. Fill in table names: `users, orders`
4. Verify technology info shows throughput/limits

### Export round-trip
1. Create a design with Service → PostgreSQL + Redis
2. Export as Docker Compose — verify:
   - `docker-compose.yaml` has services for all nodes
   - Service entry has `DATABASE_URL` and `REDIS_URL` in environment
   - `services/` dir has scaffolded code with `pg` and `ioredis` deps
   - `init/` has `schema.sql` with CREATE TABLE statements
3. Export as Native JSON, then import it — verify nodes and edges match

### Stress mode
1. Press `2` to enter Stress mode
2. Set a Database node's CAP to CP
3. Click an edge to simulate partition
4. Verify cascading effects propagate to dependent services

### Patterns
1. Drag "Cache-Aside" pattern from sidebar
2. Verify 3 nodes and 2 edges appear correctly wired
3. Each node should have the correct component type

## Adding tests

Follow the existing pattern: colocate tests with source files using `.test.ts` suffix. Tests for converters go in `src/converters/`, tests for tools go in their tool directory.

```typescript
import { describe, it, expect } from "vitest";

describe("myFeature", () => {
  it("does the thing", () => {
    expect(myFunction(input)).toBe(expectedOutput);
  });
});
```

Run a single test file:

```bash
bunx vitest run src/converters/my-converter.test.ts
```
