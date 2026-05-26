# LLM-Driven Flesh-Out — Implementation Notes & Progress

Sibling to `.context/fleshout-plan.md` (the spec). This file tracks **what I built, decisions I made, and why** as I work through the phases.

## Status — all phases shipped

| Phase | Description | Status |
|---|---|---|
| 1 | Subsystem skeleton (types, dispatch, manifest, public API) | ✅ |
| 2a | Prompt assembly (system + user) | ✅ |
| 2b | Anthropic LLM client | ✅ |
| 2c | Service LLM generator | ✅ |
| 2d | CLI entrypoint (`scripts/fleshout.ts`) | ✅ |
| 3a | Serverless + cron LLM generators | ✅ |
| 3b | Webhook generator (inbound + outbound) | ✅ |
| 3c | Stream-processor generator | ✅ |
| 4a | SQL schema generator | ✅ |
| 4b | DynamoDB schema generator | ✅ |
| 4c | OpenAPI generator (api-gateway) | ✅ |
| 4d | Remaining config generators (cache, queue, search, storage, lb, firewall, dns, cdn, k8s, warehouse) | ✅ |

53 fleshout-specific tests passing, 812 total. CLI smoke-tested end-to-end against a 2-node design (database + cache) producing expected files in `<slug>/` folders.

## Generator coverage by componentType

**LLM-driven (Tier 1):**
- `service` → handler files + tests (uses scaffold's MergedSlots as context)
- `serverless` → single-entry handler keyed to trigger
- `cron` → job body + scheduler registration + tests
- `webhook` → inbound receiver (verify/validate/dispatch) OR outbound emitter (sign/retry/idempotency) based on edge direction
- `stream-processor` → operator chain + window setup + DLQ handler

**Deterministic (Tier 2):**
- `database` (SQL: postgresql/mysql/sqlite/cockroachdb/tidb) → `schema.sql`
- `database` (DynamoDB) → `dynamo-table.json` + `access-patterns.md`
- `api-gateway` → `openapi.yaml` + `openapi.json`
- `cache` → `README.md` + `redis.conf`
- `message-queue` → Kafka topic JSON / SQS CFN / topics.md fallback
- `search-engine` → `<index>.mapping.json` (ES/OpenSearch shape)
- `storage` → S3 CFN / portable JSON
- `load-balancer` → ALB CFN + `nginx.conf`
- `firewall` → security-group CFN + `waf-rules.md` (recommendations, not auto-deployed)
- `dns` → Route53 CFN + zone file
- `cdn` → CloudFront distribution CFN
- `container-orchestration` → Deployment + Service + HPA per attached service
- `data-warehouse` → BigQuery/Snowflake/Redshift-aware DDL

**Not yet generated:** `client` (canvas placeholder for end-user devices — low priority per plan).

## Key files

- `src/converters/fleshout/types.ts` — `GeneratorContext`, `Generator`, `LLMClient`, `FleshOutResult`, `FleshOutOpts`.
- `src/converters/fleshout/prompt.ts` — Stable, cache-eligible system prompt + per-node user prompt builder. **Versioned** via `SYSTEM_PROMPT_VERSION = "v1.0.0"`. Bump when the template changes — invalidates all prompt hashes.
- `src/converters/fleshout/llm-client.ts` — Anthropic SDK wrapper. Model: `claude-opus-4-7`. Effort: `xhigh`. Adaptive thinking. JSON Schema structured outputs. System prompt cached.
- `src/converters/fleshout/manifest.ts` — `// flesh-out: <sha256>` header for regenerate detection.
- `src/converters/fleshout/dispatch.ts` — `componentType → Generator[]`. Falls through generators in order.
- `src/converters/fleshout/index.ts` — Public `fleshOutDesign(nodes, edges, opts)` API. Mirrors scaffold subsystem.
- `src/converters/fleshout/generators/_llm-runner.ts` — Shared LLM-runner used by all Tier-1 generators.
- `src/converters/fleshout/generators/*.ts` — One file per generator.
- `scripts/fleshout.ts` — CLI. `bun run fleshout <design.json> [--out|--only|--lang|--no-llm|--dry-run]`.

## Decisions log

### Why Opus 4.7 + xhigh effort + adaptive thinking
Per the `claude-api` skill: Opus 4.7 is the default; `effort: "xhigh"` is the sweet spot for code generation (the default for Claude Code itself). Adaptive thinking lets the model decide reasoning depth per node — simple service nodes won't burn extra tokens, complex ones get more headroom.

### Why structured outputs (`output_config.format`) instead of prefills
Assistant-turn prefills 400 on Opus 4.6+ and are fully removed on 4.7. Structured outputs via JSON Schema is the recommended replacement and gives stronger guarantees than a prefill ever did (no more "the model added prose before the JSON").

### Why prompt caching on the system message
The system prompt is byte-stable per language. Multiple service nodes generated in one CLI run share the system tokens — only the per-node user message is new context. With Opus 4.7's pricing, the cache hit on system tokens covers the ~1.25× write premium after the 2nd node.

### Why we reuse `resolveConcerns()`
The scaffold subsystem already computes the exact set of imports/globals/init/shutdown/healthChecks for a service based on its outbound edges. Feeding that to the LLM as `<available-clients>` keeps generated handlers consistent with the scaffolded boilerplate. The LLM is told *not* to invent new dependencies.

### Why a `// flesh-out: <hash>` header instead of a sidecar manifest
- One file per artifact, no orphaned `.fleshout.json` metadata to chase.
- Survives `git mv` and rename.
- Easy to grep for stale generators (`rg "flesh-out: " --files-with-matches`).
- Comment syntax adapts per-language (`//`, `#`, `--`).

Tradeoff: clobbers the first line. Acceptable since callers can opt out.

### Why dispatch is a flat map (not on the registry yet)
Per `CLAUDE.md`, the registry is the single source of truth for component types. Adding `fleshOut?: { kind, generator, requiredFields }` to `ComponentRegistryEntry` was tempting, but the structured plan-field shape isn't finalized — Tier 2 generators just landed and we'll learn from running them. Plan: promote to registry after the YAML field shape (`columns`, `accessPatterns`, `mappings`, `operations`) stabilizes. TODO in `dispatch.ts`.

### Why streaming (`messages.stream`) instead of `.create`
Per the skill: any request with `max_tokens > ~16K` should stream to avoid SDK HTTP timeouts. Default `max_tokens` is 32768. Streaming is also cheaper to abort if the user Ctrl-Cs the CLI.

### Why webhook direction is inferred from edge direction
On the canvas, edge direction follows the flow of data. An **inbound receiver** has outbound edges (it routes a third-party request *into* the system). An **outbound emitter** has inbound edges (services push events into it for delivery). Ambiguous cases default to outbound emitter — that's the more common "I want to send notifications" intent. Both flavors get tailored prompt guidance.

### Why stream-processor is LLM-only in v1
The plan calls for a hybrid generator: deterministic operator skeleton + LLM bodies. That needs a structured `operations` plan field on the registry, which is blocked on the same registry-promotion task. v1 ships an LLM-only generator with strong operator-chain guidance derived from `windowType` / `inputSource` / `outputSink`. TODO marked.

### Why DynamoDB output is CloudFormation
CFN's `AWS::DynamoDB::Table` shape is the most universal — accepted directly by CDK, mostly compatible with `aws_dynamodb_table` (Terraform), and the SDK's `CreateTable` schema is a strict subset. One file, multiple downstream consumers.

### Why we emit YAML *and* JSON for OpenAPI
JSON is what 90% of tooling consumes (Postman, code generators, AWS API Gateway imports). YAML is what humans diff and check in. Cost to emit both is trivial.

### Why firewall WAF rules ship as a markdown doc, not an auto-deployed config
Security-critical. Wrong WAF rules can either block legitimate traffic (bad) or open holes (worse). Recommendations live in `waf-rules.md` for human review.

## Open questions tracked as TODOs in code

| Topic | Where | Resolution plan |
|---|---|---|
| Structured plan fields (YAML in string vs widget) | `prompt.ts:plan-hints`, sql-schema, dynamo-schema, search-mapping, warehouse-schema | Push to registry-promotion phase |
| LLM budget / cost cap | `llm-client.ts` | CLI-level. Add `--max-cost` after we have empirical numbers |
| Promote dispatch to registry `fleshOut` field | `dispatch.ts` | After Tier 2 generators are stable in production |
| Output target convention | `scripts/fleshout.ts` | v1: caller-controlled via CLI `--out`. v2: UI zip download |
| K8s container image is unknown at flesh-out time | `k8s-manifests.ts` | Mark as `TODO-<svc>:latest` placeholder — caller substitutes at deploy time |
| Replication destination bucket ARN | `storage-config.ts` | Surface as `x-todo-replication` in CFN; designers fill in |
| Hybrid stream-processor (deterministic skeleton + LLM body) | `stream-llm.ts` | Blocked on `operations` structured plan field |
| Non-simple DNS routing policies (weighted/latency/geo) | `dns-config.ts` | Surface as `_todo` field in record set |
| Validation pipeline (`tsc`/`pyright`/`go vet` on generated files) | `index.ts` post-write | Phase 5; needs language-specific runners |
| UI integration (right-click "Flesh out…") | TBD | Phase 4 from the plan |

## Tests

- `prompt.test.ts` — Asserts byte stability (caching), language-specific framework hints, edge rendering, slot rendering, plan-hint exclusion of `technology`.
- `manifest.test.ts` — Hash stability, header round-trip across comment syntaxes, regenerate decisions.
- `sql-schema.test.ts` — DDL generation across dialects, composite PK, FK refs, indexes, stub fallback, malformed YAML resilience.
- `dynamo-schema.test.ts` — Base PK derivation, GSI creation, GSI suppression when partition reuses base PK, sidecar `access-patterns.md`.
- `openapi.test.ts` — Both file variants, security schemes, proxy routes, explicit endpoints, vendor extensions.
- `tier2-smoke.test.ts` — One happy-path assertion per generator for cache, queue, search-engine, storage, lb, firewall, dns, cdn, k8s, warehouse.

Run: `bunx vitest run src/converters/fleshout/`.

## Build state

`npx tsc --noEmit` clean. Vitest passes (53 fleshout-specific, 812 total). CLI smoke-tested against a 2-node design.

## What's next (post-this-session)

1. **Validate generated code** — run `tsc --noEmit` / `pyright` / `go build` on generated files before writing them. Surface failures in `FleshOutResult.errors`.
2. **Registry promotion** — extend `ComponentRegistryEntry` with `fleshOut?: { kind, generator, requiredFields, structuredFields }`. Replace the flat dispatch map with a registry lookup. Forces designers to declare which YAML plan fields each component type requires.
3. **UI surfacing** — right-click "Flesh out…" on a node; modal with diff preview; BYO API key. See plan §"UI (later)".
4. **Real run cost telemetry** — instrument `LLMClient.completeFiles` to report `cache_read_input_tokens` vs `input_tokens` per call so we can tune effort and prompt-caching empirically.
5. **Stream-processor hybrid** — once `operations` lands on the registry, fork `stream-llm.ts` into a deterministic skeleton-builder + per-operator LLM call. Cuts token spend and nondeterminism for boilerplate.
