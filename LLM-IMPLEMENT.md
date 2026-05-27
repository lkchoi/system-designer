# Buildout — Implementation Notes & Progress

Sibling to `.context/buildout-plan.md`. Tracks **what I built, decisions I made, and why**.

## Status

| Phase | Description | Status |
|---|---|---|
| 1 | Subsystem skeleton (types, dispatch, manifest, public API) | ✅ |
| 2a | Prompt assembly (system + user) | ✅ |
| 2b | ~~Anthropic LLM client~~ (removed — bundle pivot) | ⛔ |
| 2c | Service generator | ✅ (emits bundle) |
| 2d | CLI entrypoint (`scripts/buildout.ts`) | ✅ |
| 3a | Serverless + cron generators | ✅ |
| 3b | Webhook generator (inbound + outbound) | ✅ |
| 3c | Stream-processor generator | ✅ |
| 4a | SQL schema generator | ✅ |
| 4b | DynamoDB schema generator | ✅ |
| 4c | OpenAPI generator (api-gateway) | ✅ |
| 4d | Remaining config generators (cache, queue, search, storage, lb, firewall, dns, cdn, k8s, warehouse) | ✅ |
| 5 | **Bundle pivot** — Tier 1 emits vendor-agnostic bundles, no LLM call in product code | ✅ |
| 6a | Registry promotion — `buildOut` declared per component type | ✅ |
| 6b | Structured plan field types in registry | ✅ |
| 6c | Plan field widget editors (`ColumnsTable`, `AccessPatterns`, `MappingsObject`, `OperationsList`) | ✅ |
| 6d | "Build it" toolbar button + FSA/zip output dialog | ✅ |

58 buildout-specific tests passing, 829 total. CLI smoke-tested end-to-end.

## The bundle pivot

The original plan had Arkon directly call Claude to produce code (`llm-client.ts`, `runLLMGenerator`, `--no-llm` toggle). We replaced this with a **vendor-agnostic bundle emitter**.

### What each Tier 1 node emits now

```
<slug>/
├── README.md     — usage instructions across Claude Code / Cursor / web / raw API (Anthropic + OpenAI) / local (Ollama)
├── prompt.md     — full system + user prompt, self-contained
└── validate.sh   — language-aware post-gen check (tsc / pyright + py_compile / go vet)
```

The user picks their own tool to run `prompt.md`. Arkon never sees an API key.

### Why this is better

- **Zero credential management in Arkon.** No localStorage, no Settings panel, no disclosure modal, no audit burden.
- **Vendor neutral.** Works with any model: Claude, GPT, Gemini, local Ollama. User's choice.
- **Composes with existing AI workflows.** People already using Claude Code or Cursor don't get yet another integration.
- **Reviewable.** Users can read and edit prompts before running them — important for compliance.
- **Simpler product.** No "Build it" UI streaming, no cancel, no key modal. Just emit files.

### Dev-side escape hatch

`scripts/buildout.ts --execute` reads each bundle's `prompt.md`, pipes it through Claude (`claude-opus-4-7`, adaptive thinking, `xhigh` effort, JSON-schema structured output), and writes the produced files into the bundle folder. Useful for smoke-testing prompts in one terminal command.

This path **only loads via dynamic import** — the Anthropic SDK never reaches the production bundle. The web UI cannot accidentally pull it in.

## Generator coverage by componentType

**Bundle emitters (Tier 1, LLM-driven):**
- `service` → handler files + tests bundle (uses scaffold's MergedSlots as context)
- `serverless` → single-entry handler bundle keyed to trigger
- `cron` → job body + scheduler registration bundle
- `webhook` → inbound receiver OR outbound emitter bundle, based on edge direction
- `stream-processor` → operator chain bundle

**Deterministic generators (Tier 2, no LLM ever):**
- `database` (SQL: postgresql/mysql/sqlite/cockroachdb/tidb) → `schema.sql`
- `database` (DynamoDB) → `dynamo-table.json` + `access-patterns.md`
- `api-gateway` → `openapi.yaml` + `openapi.json`
- `cache` → `README.md` + `redis.conf`
- `message-queue` → Kafka `topics.json` / SQS CFN / `topics.md` fallback
- `search-engine` → `<index>.mapping.json` (ES/OpenSearch shape)
- `storage` → S3 CFN / portable JSON
- `load-balancer` → ALB CFN + `nginx.conf`
- `firewall` → security-group CFN + `waf-rules.md`
- `dns` → Route53 CFN + zone file
- `cdn` → CloudFront distribution CFN
- `container-orchestration` → Deployment + Service + HPA per attached service
- `data-warehouse` → BigQuery/Snowflake/Redshift-aware DDL

**Not yet generated:** `client` (canvas placeholder for end-user devices — low priority).

## Key files

- `src/registry/types.ts` — `BuildOutSpec`, `StructuredFieldDef`. Declares which generator(s) each component type uses and what structured plan fields it needs.
- `src/registry/builtin-entries.ts` — every builtin component carries its `buildOut` block here.
- `src/components/widgets/StructuredFieldEditor.tsx` — dispatcher.
- `src/components/widgets/{ColumnsTable,AccessPatterns,MappingsObject,OperationsList}Widget.tsx` — editors per structured field type.
- `src/components/widgets/yaml-helpers.ts` — shared parse/dump.
- `src/components/BuildItDialog.tsx` — toolbar-triggered build modal with FSA/zip output.
- `src/converters/buildout/types.ts` — `GeneratorContext`, `Generator`, `BuildOutResult`, `BuildOutOpts`.
- `src/converters/buildout/prompt.ts` — stable system prompt + per-node user prompt builder. Versioned via `SYSTEM_PROMPT_VERSION = "v1.0.0"`.
- `src/converters/buildout/bundle.ts` — `emitBundle()` — turns a prompt into the README + prompt.md + validate.sh trio.
- `src/converters/buildout/manifest.ts` — prompt-hash helpers (vestigial since the bundle pivot; kept for the dev-only `--execute` path's eventual regenerate detection).
- `src/converters/buildout/dispatch.ts` — `componentType → Generator[]`.
- `src/converters/buildout/index.ts` — public `buildOutDesign(nodes, edges, opts)` API.
- `src/converters/buildout/execute-bundles.ts` — **dev-only**, dynamically imported by the `--execute` CLI flag. Holds the Anthropic SDK dependency.
- `src/converters/buildout/generators/*.ts` — one file per generator.
- `scripts/buildout.ts` — dev script. `bun run buildout <design.json>` emits bundles; `--execute` additionally runs them through Claude.

## Decisions log

### Why bundles over direct LLM calls
Avoids vendor lock-in and credential management in Arkon. Users pick their own model. See "The bundle pivot" above for the full rationale.

### Why we still reuse `resolveConcerns()`
The scaffold subsystem already computes the exact set of imports/globals/init/shutdown/healthChecks for a service based on its outbound edges. Inserting that into the bundle's prompt under `<available-clients>` means whichever LLM the user runs is told *not* to invent new dependencies — it must use what scaffold already wired.

### Why dispatch is a flat map (not on the registry yet)
Per `CLAUDE.md`, the registry is the single source of truth for component types. Adding `buildOut?: { kind, generator, requiredFields }` to `ComponentRegistryEntry` was tempting, but the structured plan-field shape isn't finalized — Tier 2 generators just landed and we'll learn from running them. Plan: promote to registry after `columns`, `accessPatterns`, `mappings`, `operations` YAML shapes stabilize. TODO in `dispatch.ts`.

### Why webhook direction is inferred from edge direction
On the canvas, edge direction follows the flow of data. An **inbound receiver** has outbound edges (it routes a third-party request *into* the system). An **outbound emitter** has inbound edges (services push events into it for delivery). Ambiguous cases default to outbound emitter. Both flavors get tailored guidance blocks appended to the service prompt.

### Why stream-processor is bundle-only in v1
The plan calls for a hybrid: deterministic operator skeleton + per-operator LLM bodies. That needs a structured `operations` plan field on the registry, which is blocked on the same registry-promotion task. v1 ships a single-bundle stream-processor generator with strong operator-chain guidance derived from `windowType`/`inputSource`/`outputSink`. TODO marked.

### Why DynamoDB output is CloudFormation
CFN's `AWS::DynamoDB::Table` shape is the most universal — accepted directly by CDK, mostly compatible with Terraform's `aws_dynamodb_table`, and the SDK's `CreateTable` schema is a strict subset. One file, multiple downstream consumers.

### Why we emit YAML *and* JSON for OpenAPI
JSON is what 90% of tooling consumes. YAML is what humans diff and check in. Cost to emit both is trivial.

### Why firewall WAF rules ship as a markdown doc, not an auto-deployed config
Security-critical. Wrong WAF rules either block legitimate traffic (bad) or open holes (worse). Recommendations live in `waf-rules.md` for human review.

### Why `--execute` uses dynamic import
Keeps the Anthropic SDK off the product code path. The Cloudflare bundle never sees `@anthropic-ai/sdk`. The web UI cannot accidentally pull it in. Only `scripts/buildout.ts` resolves it at runtime when `--execute` is passed.

## Open questions / next steps

| Topic | Where | Plan |
|---|---|---|
| Stream-processor hybrid (deterministic skeleton + LLM bodies) | `stream-llm.ts` | Now unblocked — `operations` structured field has landed. Next: split skeleton emission (source/sink wiring + window setup) from per-operator prompt generation. |
| Generators consume structured fields instead of YAML strings | `sql-schema.ts`, `dynamo-schema.ts`, etc. | They already parse YAML; widgets emit YAML. Consider tightening by passing parsed objects directly from dispatcher to generator. |
| Per-node right-click "Build it" | `PropertiesPanel`/canvas | Today the dialog has "Selected only" scope, which covers the use case without a context-menu system. Right-click sugar is a UX polish, not blocking. |
| Validation pipeline (tsc/pyright/go vet) | bundle's `validate.sh` | Already in bundle. Could hoist into an in-UI "Validate" button that runs the script via a subprocess in `--execute` mode. |
| Telemetry — token usage + cache hits | `execute-bundles.ts` (dev-only) | Logs per-call usage already. UI doesn't execute, so no UI counterpart needed. |

## Tests

- `prompt.test.ts` — system prompt byte-stability, language-specific framework hints, edge rendering, slot rendering.
- `manifest.test.ts` — hash stability, header round-trip, regenerate decisions.
- `bundle.test.ts` — 3-file emission, prompt embedding, expected-outputs listing, vendor-neutral README, per-language validator.
- `sql-schema.test.ts` — DDL across dialects, composite PK, FK refs, indexes, stub fallback, malformed YAML resilience.
- `dynamo-schema.test.ts` — base PK derivation, GSI creation, GSI suppression when partition reuses base PK, sidecar `access-patterns.md`.
- `openapi.test.ts` — YAML + JSON variants, security schemes, proxy routes, explicit endpoints, vendor extensions.
- `tier2-smoke.test.ts` — happy-path assertion per generator for cache, queue, search-engine, storage, lb, firewall, dns, cdn, k8s, warehouse.

Run: `bunx vitest run src/converters/buildout/`.

## Build state

`npx tsc --noEmit` clean. 58 buildout-specific tests pass (829 total). CLI smoke-tested against a service+database design — produced one bundle and one schema.sql, exactly the contract.
