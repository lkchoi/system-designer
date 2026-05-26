/**
 * Deterministic cache configuration generator.
 *
 * Emits a brief operational README plus a Redis-style config snippet
 * (works directly for Redis/Valkey; serves as documentation for
 * Memcached, Hazelcast, etc.). Cache nodes don't need code — they need
 * documentation of the key namespace, TTL policy, and eviction strategy
 * so the services consuming the cache agree on conventions.
 */

import type { Generator, GeneratorContext, GeneratedFile } from "../types";

export const cacheConfigGenerator: Generator = {
  kind: "deterministic",
  supports: (ctx) => ctx.node.componentType === "cache",
  async generate(ctx): Promise<GeneratedFile[]> {
    const p = ctx.node.plan ?? {};
    const ttl = p.ttl || "3600s";
    const eviction = p.eviction || "allkeys-lru";
    const strategy = p.strategy || "Write-through";
    const maxSize = p.maxSize || "512mb";

    const readme = [
      `# ${ctx.node.label} — cache conventions`,
      ``,
      ctx.node.description || "Shared cache used by upstream services.",
      ``,
      `## Policy`,
      `- **Technology**: ${p.technology || "unspecified"}`,
      `- **Strategy**: ${strategy}`,
      `- **Default TTL**: ${ttl}`,
      `- **Eviction**: ${eviction}`,
      `- **Max size**: ${maxSize}`,
      ``,
      `## Key namespace`,
      `Adopt \`<service>:<resource>:<id>\` (e.g. \`orders-svc:order:42\`).`,
      `Override per-call TTL when the data has a known expiry; default otherwise.`,
      ``,
      `## Upstream consumers`,
      ...(ctx.inbound.length === 0
        ? [`(none connected on the canvas)`]
        : ctx.inbound.map((e) => `- ${e.otherNodeLabel} (${e.otherComponentType})`)),
      ``,
    ].join("\n");

    // Redis-style: most Redis-compatible deploys accept these directives.
    const conf = [
      `# Redis-compatible config for ${ctx.node.label}`,
      `maxmemory ${maxSize}`,
      `maxmemory-policy ${eviction}`,
      // The TTL is a convention applied by clients; we surface it as a comment.
      `# Default TTL (applied by clients via EXPIRE): ${ttl}`,
    ].join("\n");

    return [
      { path: "README.md", contents: readme },
      { path: "redis.conf", contents: conf + "\n" },
    ];
  },
};
