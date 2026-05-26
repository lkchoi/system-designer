/**
 * Prompt assembly for LLM-driven service generation.
 *
 * The split between `buildSystemPrompt` (stable, cache-eligible) and
 * `buildUserPrompt` (per-node, volatile) is deliberate: per the Anthropic
 * caching docs (see `shared/prompt-caching.md`), the system prompt should
 * be byte-stable so the cache hits across nodes in the same run.
 *
 * Anything that varies per node — description, edges, slots — goes in the
 * user prompt.
 *
 * Design tradeoff: we considered feeding the entire scaffold-generated
 * source as context (so the LLM only emits the handler bodies). Decided
 * against for v1 — too much context for marginal benefit, and the scaffold
 * code is well-typed enough that the LLM doesn't need to see boilerplate to
 * fill the body. We do pass the merged client list so the LLM knows which
 * imports/globals exist.
 */

import type { ScaffoldLang } from "../scaffold/concerns/types";
import type { GeneratorContext } from "./types";

interface LanguageProfile {
  /** Human-readable name shown in prompts. */
  name: string;
  /** Idiomatic test framework name to instruct the LLM to use. */
  testFramework: string;
  /** File extension for source files. */
  ext: string;
  /** File extension/suffix for test files. */
  testExt: string;
  /** Comment syntax for the prompt-hash header. */
  commentSyntax: "//" | "#" | "--";
}

const LANGUAGE_PROFILES: Record<ScaffoldLang, LanguageProfile> = {
  node: {
    name: "TypeScript (Node.js)",
    testFramework: "vitest",
    ext: "ts",
    testExt: "test.ts",
    commentSyntax: "//",
  },
  python: {
    name: "Python 3.12",
    testFramework: "pytest",
    ext: "py",
    testExt: "test.py",
    commentSyntax: "#",
  },
  go: {
    name: "Go",
    testFramework: "the standard `testing` package",
    ext: "go",
    testExt: "_test.go",
    commentSyntax: "//",
  },
};

export function languageProfile(lang: ScaffoldLang): LanguageProfile {
  return LANGUAGE_PROFILES[lang];
}

/**
 * Stable system prompt. Versioned via the constant below so a prompt-text
 * change automatically invalidates manifests on the next run.
 */
const SYSTEM_PROMPT_VERSION = "v1.0.0";

export function buildSystemPrompt(lang: ScaffoldLang): string {
  const prof = LANGUAGE_PROFILES[lang];

  // NOTE: keep this byte-stable across nodes in the same run for prompt
  // caching to work. Anything node-specific belongs in the user prompt.
  return [
    `You are an expert ${prof.name} engineer generating production-quality business logic for a service.`,
    `Prompt template version: ${SYSTEM_PROMPT_VERSION}`,
    ``,
    `## Output contract`,
    `Return a JSON object with a "files" array. Each entry has "path" (relative, no leading slash) and "contents" (full file text).`,
    `Do NOT include explanations, markdown fences, or prose outside the JSON object.`,
    ``,
    `## Style rules`,
    `- Idiomatic ${prof.name}. No over-engineering. No speculative abstractions.`,
    `- Use ONLY the imports and client globals listed in <available-clients>. Do not introduce new dependencies.`,
    `- Read configuration from environment variables — never hard-code secrets, URLs, or hostnames.`,
    `- Handle errors at boundaries; return structured error responses for HTTP endpoints (matching the listed response codes).`,
    `- Include input validation for any data crossing a trust boundary (HTTP body, message payload).`,
    `- No comments that just restate the code. Comments only for non-obvious WHY.`,
    ``,
    `## Testing`,
    `- For every public function or HTTP endpoint, emit at least one happy-path test and one error-path test using ${prof.testFramework}.`,
    `- Unit tests go in files matching the project convention (e.g. \`*.test.ts\` for Node, \`*_test.go\` for Go, \`test_*.py\` for Python).`,
    `- Integration tests against real clients (databases, queues) go in \`*.integ.test.ts\` style files. Use the clients listed in <available-clients> directly — never mock them.`,
    `- Aim for tests that would catch regressions, not coverage padding.`,
    ``,
    `## File layout`,
    `- One handler file per endpoint group or message-consumer concern.`,
    `- Co-locate tests next to source.`,
    `- If multiple files, choose paths that match the language's standard project layout.`,
  ].join("\n");
}

/** Identify the system-prompt version for hashing — bump on template changes. */
export function systemPromptVersion(): string {
  return SYSTEM_PROMPT_VERSION;
}

/**
 * Build the per-node user prompt.
 *
 * Edges and merged slots are serialized as compact JSON-ish text rather
 * than free prose — empirically the LLM follows structured input more
 * reliably than narrative.
 */
export function buildServiceUserPrompt(ctx: GeneratorContext): string {
  const { node, inbound, outbound, mergedSlots, endpoints, language = "node" } = ctx;
  const prof = LANGUAGE_PROFILES[language];

  const lines: string[] = [];

  lines.push(`<service>`);
  lines.push(`Name: ${node.label}`);
  lines.push(`Component type: ${node.componentType}`);
  lines.push(`Language: ${prof.name}`);
  lines.push(`</service>`);
  lines.push(``);

  lines.push(`<description>`);
  lines.push(node.description?.trim() || "(no description provided — implement a minimal stub)");
  lines.push(`</description>`);
  lines.push(``);

  if (endpoints && endpoints.length > 0) {
    lines.push(`<endpoints>`);
    for (const ep of endpoints) {
      const qp = ep.queryParams?.length
        ? ` query=[${ep.queryParams.map((q) => `${q.name}${q.required ? "" : "?"}`).join(",")}]`
        : "";
      const codes = ep.responseCodes?.length ? ` responses=[${ep.responseCodes.join(",")}]` : "";
      lines.push(`- ${ep.method.toUpperCase()} ${ep.path}${qp}${codes}`);
    }
    lines.push(`</endpoints>`);
    lines.push(``);
  }

  if (inbound.length > 0) {
    lines.push(`<inbound-edges>`);
    for (const e of inbound) {
      lines.push(
        `- from ${e.otherNodeLabel} (${e.otherComponentType}, tech=${e.otherTechId})` +
          (e.label ? ` "${e.label}"` : "") +
          (e.protocol ? ` via ${e.protocol}` : "") +
          (e.format ? ` ${e.format}` : ""),
      );
    }
    lines.push(`</inbound-edges>`);
    lines.push(``);
  }

  if (outbound.length > 0) {
    lines.push(`<outbound-edges>`);
    for (const e of outbound) {
      lines.push(
        `- to ${e.otherNodeLabel} (${e.otherComponentType}, tech=${e.otherTechId})` +
          (e.label ? ` "${e.label}"` : "") +
          (e.protocol ? ` via ${e.protocol}` : "") +
          (e.format ? ` ${e.format}` : ""),
      );
    }
    lines.push(`</outbound-edges>`);
    lines.push(``);
  }

  if (mergedSlots) {
    lines.push(`<available-clients>`);
    if (Object.keys(mergedSlots.deps).length > 0) {
      lines.push(`Dependencies (already installed):`);
      for (const [pkg, ver] of Object.entries(mergedSlots.deps)) lines.push(`  ${pkg} ${ver}`);
    }
    if (mergedSlots.imports.length > 0) {
      lines.push(`Imports (already present at the top of generated entrypoint):`);
      for (const imp of mergedSlots.imports) lines.push(`  ${imp}`);
    }
    if (mergedSlots.globals.length > 0) {
      lines.push(`Global declarations (already present):`);
      for (const g of mergedSlots.globals) lines.push(`  ${g}`);
    }
    if (mergedSlots.healthChecks.length > 0) {
      lines.push(`Health-check expressions (already wired):`);
      for (const h of mergedSlots.healthChecks) lines.push(`  ${h}`);
    }
    lines.push(`</available-clients>`);
    lines.push(``);
  }

  // TODO(open-question): structured plan fields. For now, dump remaining
  // plan entries as a hint — the LLM treats them as soft requirements.
  const planEntries = Object.entries(node.plan ?? {}).filter(([k]) => k !== "technology");
  if (planEntries.length > 0) {
    lines.push(`<plan-hints>`);
    for (const [k, v] of planEntries) lines.push(`- ${k}: ${v}`);
    lines.push(`</plan-hints>`);
    lines.push(``);
  }

  lines.push(`<task>`);
  lines.push(
    `Implement the business logic for "${node.label}" as described above. ` +
      `Generate the handler files plus tests. Output the JSON files contract.`,
  );
  lines.push(`</task>`);

  return lines.join("\n");
}
