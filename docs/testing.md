# Testing

## Overview

Three test tiers, tracked with `./scripts/test-pyramid.sh`:

| Tier        | Runner     | Suffix            | Location | Command            |
| ----------- | ---------- | ----------------- | -------- | ------------------ |
| Unit        | Vitest     | `*.test.ts`       | `src/`   | `bun run test`     |
| Integration | Vitest     | `*.integ.test.ts` | `src/`   | `bun run test`     |
| E2E         | Playwright | `*.spec.ts`       | `e2e/`   | `bun run test:e2e` |

```bash
bun run test            # unit + integration (vitest)
bun run test:watch      # vitest watch mode
bun run test:e2e        # e2e (playwright, chromium + firefox)
bun run test:e2e:ui     # playwright interactive UI
bunx tsc --noEmit       # type check only
./scripts/test-pyramid.sh  # print pyramid breakdown
```

## E2E tests (Playwright)

Runs against Chromium and Firefox. WebKit is excluded — OPFS `FileSystemWritableFileStream` is unsupported.

### `e2e/app.spec.ts` — UI interactions

| Test                    | What it covers                                     |
| ----------------------- | -------------------------------------------------- |
| app loads               | Smoke test — page title                            |
| add node from sidebar   | Drop component onto canvas via synthetic DragEvent |
| connect two nodes       | Drag between handles to create an edge             |
| connection validation   | Incompatible types (cron + client) rejected        |
| edit node properties    | Click node, change label in properties panel       |
| delete a node           | Delete key removes node and its edges              |
| undo and redo           | Undo restores deleted node, redo removes it        |
| drop a pattern template | Cache-Aside creates container + 3 nodes + 2 edges  |
| mode switching          | Plan/Stress/Monitor show correct UI                |
| stress testing          | Click cycles failure state, OFFLINE overlay        |
| export native JSON      | Export produces valid JSON with nodes/edges        |
| import design           | File chooser loads a JSON design                   |
| auto-save persistence   | Nodes survive page reload                          |
| multiple designs        | Independent state across designs                   |
| sidebar search          | Filter narrows visible components                  |
| inline label editing    | Double-click, edit, Enter commits                  |
| panel dock toggle       | Right/bottom dock position                         |
| hotkeys                 | `/`, `1`–`2` mode keys, `?` help overlay           |
| flow path recording     | Toggle mode, click nodes, save with name           |
| flow path remove last   | Re-clicking last node removes it                   |
| flow path clear         | Clear button resets to empty                       |
| flow path load          | Click sidebar entry to reload saved flow           |

### `e2e/db.spec.ts` — database layer

Exercises the sql.js db functions via `page.evaluate()` in a real browser context (OPFS-backed).

| Test              | Functions exercised                                                      |
| ----------------- | ------------------------------------------------------------------------ |
| create + list     | `createDesign`, `listDesigns`                                            |
| get + rename      | `getDesign`, `renameDesign` (verifies updatedAt advances)                |
| save + load state | `saveDesignState`, `loadDesignState` (nodes, edges, viewport round-trip) |
| flow paths        | `saveFlowPath`, `loadDesignState`, `deleteFlowPath`                      |
| fork              | `forkDesign` (copies state + flow paths, sets parentId, new IDs)         |
| delete            | `deleteDesign` (cascades through all tables)                             |
| export + import   | `exportDesign`, `importDesign` (full round-trip)                         |
| initDB idempotent | `initDB()` twice returns same instance                                   |
| getDB works       | `getDB()` returns usable sql.js Database                                 |

## Unit tests (Vitest)

### Converters

| File                                            | What it tests                                                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `converters/docker-compose.test.ts`             | Bundle generation: compose YAML, service entries, depends_on, env var wiring, secrets, init scripts, volume mounts, excluded components, vendor-locked serverless |
| `converters/scaffold/scaffold.test.ts`          | Scaffold output for Node.js, Go, Python: files, deps, health endpoint, endpoint stubs, connection SDK injection                                                   |
| `converters/scaffold/concerns/concerns.test.ts` | Merge engine, concern resolution, client concern registry, integration (scaffoldService with connections)                                                         |
| `converters/cloudformation.test.ts`             | CFn resource generation, DynamoDB attribute definitions                                                                                                           |
| `converters/aws-cdk.test.ts`                    | CDK construct generation, module imports                                                                                                                          |
| `converters/pulumi.test.ts`                     | Pulumi resource generation                                                                                                                                        |
| `converters/nomad.test.ts`                      | Nomad job spec structure                                                                                                                                          |
| `converters/localstack.test.ts`                 | LocalStack compose + CFn template                                                                                                                                 |
| `converters/claude-md.test.ts`                  | CLAUDE.md content generation                                                                                                                                      |
| `converters/secrets.test.ts`                    | Secret generation, .env content                                                                                                                                   |
| `converters/wiring.test.ts`                     | Edge to env var mapping                                                                                                                                           |
| `converters/init-scripts.test.ts`               | Schema SQL, bucket scripts, topic scripts                                                                                                                         |

### Connections

| File                              | What it tests                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `connections/connections.test.ts` | Component defaults, tech rule lookup, connection resolution, blocked pairs, recommended targets, IaC metadata, env var templates, data integrity |

### Tools

| File                                                 | What it tests                                    |
| ---------------------------------------------------- | ------------------------------------------------ |
| `tools/capacity-calculator/capacity.test.ts`         | Storage projections, bandwidth, DynamoDB WCU/RCU |
| `tools/cron-translator/cron.test.ts`                 | Bidirectional cron parsing, next fire times      |
| `tools/sla-calculator/sla.test.ts`                   | Composite SLA computation                        |
| `tools/cache-sizer/cache.test.ts`                    | Memory estimation, eviction calculations         |
| `tools/latency-budget-calculator/latency.test.ts`    | Budget allocation, overflow detection            |
| `tools/dns-ttl-advisor/dns.test.ts`                  | TTL recommendations                              |
| `tools/payload-size-estimator/payload.test.ts`       | Payload size calculations                        |
| `tools/regex-tester/regex.test.ts`                   | Regex matching, flags                            |
| `tools/jwt-inspector/jwt.test.ts`                    | JWT decode, validation                           |
| `tools/partition-calculator/partition.test.ts`       | Partition key distribution                       |
| `tools/connection-pool-sizer/pool.test.ts`           | Pool size recommendations                        |
| `tools/serverless-cost-estimator/serverless.test.ts` | Cost projections                                 |
| `tools/storage-growth-projector/storage.test.ts`     | Growth projections                               |
| `tools/replication-planner/replication.test.ts`      | Replication topology                             |

### Other

| File                                 | What it tests                                                    |
| ------------------------------------ | ---------------------------------------------------------------- |
| `registry/ComponentRegistry.test.ts` | Registry lookup, connection validation, custom type registration |
| `patterns/builtin-patterns.test.ts`  | Pattern instantiation, unique IDs, position calculation          |
| `db/io.test.ts`                      | `parseDesignJSON` validation, defaults, round-trip               |
| `data.test.ts`                       | Utility functions                                                |

## Adding tests

### Unit / integration tests

Colocate with source files. Use `.test.ts` for unit tests, `.integ.test.ts` for integration tests.

```bash
bunx vitest run src/converters/my-converter.test.ts
```

### E2E tests

Add to `e2e/app.spec.ts` for UI interactions. Use the `addNode()` and `connectNodes()` helpers defined at the top of the file.

```bash
bunx playwright test --project=chromium -g "my test name"
```

## Reporting

- **Vitest**: terminal output
- **Playwright HTML report**: `playwright-report/` (auto-generated)
- **Playwright JSON report**: `test-results/results.json` (per-test durations, flakiness)
- **Test pyramid**: `./scripts/test-pyramid.sh`
