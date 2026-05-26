# LLM-Driven Flesh-Out — Implementation Notes & Progress

Sibling to `.context/fleshout-plan.md` (the spec). This file tracks **what I built, decisions I made, and why** as I work through the phases.

## Status

| Phase | Description | Status |
|---|---|---|
| 1 | Subsystem skeleton (types, dispatch, manifest, public API) | ✅ done |
| 2a | Prompt assembly (system + user) | ✅ done |
| 2b | Anthropic LLM client | ✅ done |
| 2c | Service LLM generator | ✅ done |
| 2d | CLI entrypoint (`scripts/fleshout.ts`) | 🚧 in progress |
| 3a | Serverless + cron LLM generators | ⏳ |
| 3b | Webhook generator | ⏳ |
| 3c | Stream-processor hybrid generator | ⏳ |
| 4a | SQL schema generator (deterministic) | ⏳ |
| 4b | DynamoDB schema generator (deterministic) | ⏳ |
| 4c | OpenAPI generator (deterministic) | ⏳ |
| 4d | Remaining config generators | ⏳ |

## Key files

- `src/converters/fleshout/types.ts` — `GeneratorContext`, `Generator`, `LLMClient`, `FleshOutResult`, `FleshOutOpts`.
- `src/converters/fleshout/prompt.ts` — Stable, cache-eligible system prompt + per-node user prompt builder. **Versioned** via `SYSTEM_PROMPT_VERSION = "v1.0.0"`. Bump when the template changes — invalidates all prompt hashes.
- `src/converters/fleshout/llm-client.ts` — Anthropic SDK wrapper. Model: `claude-opus-4-7`. Effort: `xhigh`. Adaptive thinking. JSON Schema structured outputs. System prompt cached.
- `src/converters/fleshout/manifest.ts` — `// flesh-out: <sha256>` header for regenerate detection.
- `src/converters/fleshout/dispatch.ts` — `componentType → Generator[]`. Falls through generators in order.
- `src/converters/fleshout/index.ts` — Public `fleshOutDesign(nodes, edges, opts)` API. Mirrors scaffold subsystem.
- `src/converters/fleshout/generators/service-llm.ts` — First concrete generator.

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
Per `CLAUDE.md`, the registry is the single source of truth for component types. Adding `fleshOut?: { kind, generator, requiredFields }` to `ComponentRegistryEntry` was tempting, but premature — we haven't shipped a deterministic generator yet, so the structured-field shape isn't finalized. Plan: ship Tier 2 deterministic generators first (forces the structured plan-field design), then promote to the registry. TODO marked in `dispatch.ts`.

### Why streaming (`messages.stream`) instead of `.create`
Per the skill: any request with `max_tokens > ~16K` should stream to avoid SDK HTTP timeouts. Default `max_tokens` is 32768. Streaming is also cheaper to abort if the user Ctrl-Cs the CLI.

## Open questions tracked as TODOs in code

| Topic | Where | Resolution plan |
|---|---|---|
| Structured plan fields (YAML in string vs widget) | `prompt.ts:plan-hints` | Push to Tier 2 — DynamoDB access patterns motivate the design |
| LLM budget / cost cap | `llm-client.ts` | CLI-level, not generator-level. Add `--max-cost` after we have empirical numbers |
| Promote dispatch to registry `fleshOut` field | `dispatch.ts` | After Tier 2 generators are stable |
| Output target convention | `index.ts` (file paths) | v1: caller-controlled via CLI `--out`. v2: UI zip download |

## Tests

- `prompt.test.ts` — 9 cases. Asserts byte stability (caching), language-specific framework hints, edge rendering, slot rendering, plan-hint exclusion of `technology`.
- `manifest.test.ts` — 10 cases. Hash stability, header round-trip across comment syntaxes, regenerate decisions.

Run: `bunx vitest run src/converters/fleshout/`.

## Build state

`npx tsc --noEmit` clean. Vitest passes (19 fleshout-specific, 790 total).
