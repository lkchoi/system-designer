import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FetchResult, TechnologyPricing } from "./types.ts";
import { log } from "./utils.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../../src/registry/pricing.ts");

/** Escape a string for use inside a TypeScript string literal. */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/** Indent a multi-line string by `n` spaces. */
function indent(s: string, n: number): string {
  const pad = " ".repeat(n);
  return s
    .split("\n")
    .map((line, i) => (i === 0 ? line : pad + line))
    .join("\n");
}

function renderTier(t: { name: string; price: string; description?: string }): string {
  if (!t.description) {
    return `{ name: "${esc(t.name)}", price: "${esc(t.price)}" }`;
  }
  const inner = [
    `name: "${esc(t.name)}"`,
    `price: "${esc(t.price)}"`,
    `description: "${esc(t.description)}"`,
  ].join(", ");
  if (inner.length > 80) {
    // Use relative 2-space indentation — indent() adds the base offset
    return `{\n  name: "${esc(t.name)}",\n  price: "${esc(t.price)}",\n  description: "${esc(t.description)}",\n}`;
  }
  return `{ ${inner} }`;
}

function renderMode(m: { name: string; priceImpact: string; description: string }): string {
  const inner = [
    `name: "${esc(m.name)}"`,
    `priceImpact: "${esc(m.priceImpact)}"`,
    `description: "${esc(m.description)}"`,
  ].join(", ");
  if (inner.length > 80) {
    return `{\n  name: "${esc(m.name)}",\n  priceImpact: "${esc(m.priceImpact)}",\n  description:\n    "${esc(m.description)}",\n}`;
  }
  return `{ ${inner} }`;
}

function renderPricing(key: string, p: TechnologyPricing): string {
  const lines: string[] = [];
  const q =
    key.includes(" ") || key.includes("(") || key.includes("/") || key.includes(".")
      ? `"${esc(key)}"`
      : key;

  lines.push(`  ${q}: {`);
  // model
  if (p.model.length > 70) {
    lines.push(`    model:`);
    lines.push(`      "${esc(p.model)}",`);
  } else {
    lines.push(`    model: "${esc(p.model)}",`);
  }
  // unit
  if (p.unit.length > 70) {
    lines.push(`    unit:`);
    lines.push(`      "${esc(p.unit)}",`);
  } else {
    lines.push(`    unit: "${esc(p.unit)}",`);
  }
  // tiers
  lines.push(`    tiers: [`);
  for (const t of p.tiers) {
    const rendered = renderTier(t);
    lines.push(`      ${indent(rendered, 6)},`);
  }
  lines.push(`    ],`);
  // freeTier
  if (p.freeTier) {
    if (p.freeTier.length > 70) {
      lines.push(`    freeTier:`);
      lines.push(`      "${esc(p.freeTier)}",`);
    } else {
      lines.push(`    freeTier: "${esc(p.freeTier)}",`);
    }
  }
  // modes
  if (p.modes && p.modes.length > 0) {
    lines.push(`    modes: [`);
    for (const m of p.modes) {
      const rendered = renderMode(m);
      lines.push(`      ${indent(rendered, 6)},`);
    }
    lines.push(`    ],`);
  }
  lines.push(`  },`);
  return lines.join("\n");
}

/** Category labels for grouping technologies in the output. */
const CATEGORY_ORDER = [
  "DATABASES",
  "API GATEWAYS",
  "LOAD BALANCERS",
  "CDN",
  "CACHES",
  "MESSAGE QUEUES & STREAMING",
  "STORAGE",
  "FIREWALLS & SECURITY",
  "DNS",
  "SERVERLESS",
  "CONTAINERS & ORCHESTRATION",
  "STREAM PROCESSORS",
  "DATA WAREHOUSES",
  "WEBHOOKS",
  "SCHEDULING",
  "SEARCH ENGINES",
  "CLIENT FRAMEWORKS",
  "SERVICE FRAMEWORKS",
] as const;

/** Map technology names to categories for output grouping. */
function categorize(tech: string): string {
  const t = tech.toLowerCase();
  // Databases
  if (
    [
      "postgresql",
      "mysql",
      "mongodb",
      "dynamodb",
      "cassandra",
      "cockroachdb",
      "sql server",
      "oracle database",
      "tidb",
      "scylladb",
      "mariadb",
      "amazon aurora",
      "sqlite",
      "neo4j",
      "azure cosmos db",
      "influxdb",
      "google cloud firestore",
      "couchbase",
    ].some((d) => t === d.toLowerCase())
  )
    return "DATABASES";
  // API Gateways
  if (
    t.includes("api gateway") ||
    t.includes("api management") ||
    ["kong", "apigee", "nginx", "envoy", "traefik"].some((g) => t === g)
  )
    return "API GATEWAYS";
  // Load Balancers
  if (t.includes("load balan") || t.includes("alb") || t.includes("nlb") || t === "haproxy")
    return "LOAD BALANCERS";
  // CDN
  if (
    t.includes("cdn") ||
    t.includes("cloudfront") ||
    t.includes("edge network") ||
    ["fastly", "akamai"].some((c) => t === c)
  )
    return "CDN";
  // Caches
  if (
    ["redis", "memcached", "dragonfly", "keydb", "hazelcast", "varnish", "cdn edge cache"].some(
      (c) => t === c,
    )
  )
    return "CACHES";
  // Message Queues & Streaming
  if (
    [
      "apache kafka",
      "rabbitmq",
      "amazon sqs",
      "google pub/sub",
      "nats",
      "apache pulsar",
      "azure service bus",
      "redis streams",
    ].some((m) => t === m.toLowerCase())
  )
    return "MESSAGE QUEUES & STREAMING";
  // Storage
  if (
    [
      "amazon s3",
      "google cloud storage",
      "azure blob storage",
      "minio",
      "cloudflare r2",
      "amazon efs",
      "amazon ebs",
      "ceph",
    ].some((s) => t === s.toLowerCase())
  )
    return "STORAGE";
  // Firewalls & Security
  if (
    t.includes("waf") ||
    t.includes("firewall") ||
    t.includes("security") ||
    t.includes("armor") ||
    t.includes("modsecurity") ||
    t.includes("palo alto")
  )
    return "FIREWALLS & SECURITY";
  // DNS
  if (t.includes("dns") || t.includes("route 53") || t.includes("coredns") || t.includes("ns1"))
    return "DNS";
  // Serverless
  if (
    t.includes("lambda") ||
    t.includes("cloud functions") ||
    t.includes("azure functions") ||
    t.includes("workers") ||
    t.includes("vercel functions")
  )
    return "SERVERLESS";
  // Containers
  if (
    t.includes("fargate") ||
    t.includes("cloud run") ||
    t.includes("kubernetes") ||
    t.includes("ecs") ||
    t.includes("docker") ||
    t.includes("nomad") ||
    t.includes("openshift") ||
    t.includes("gke")
  )
    return "CONTAINERS & ORCHESTRATION";
  // Stream Processors
  if (
    t.includes("kafka streams") ||
    t.includes("flink") ||
    t.includes("spark streaming") ||
    t.includes("kinesis") ||
    t.includes("dataflow") ||
    t.includes("firehose") ||
    t.includes("risingwave")
  )
    return "STREAM PROCESSORS";
  // Data Warehouses
  if (
    [
      "snowflake",
      "google bigquery",
      "amazon redshift",
      "databricks (lakehouse)",
      "clickhouse",
      "apache druid",
      "duckdb",
    ].some((w) => t === w.toLowerCase())
  )
    return "DATA WAREHOUSES";
  // Webhooks
  if (
    ["svix", "hookdeck", "zapier webhooks", "ngrok"].some((w) => t === w.toLowerCase()) ||
    t.includes("custom (express")
  )
    return "WEBHOOKS";
  // Scheduling
  if (
    [
      "aws eventbridge scheduler",
      "gcp cloud scheduler",
      "cron (linux)",
      "kubernetes cronjob",
      "celery beat",
      "temporal",
      "azure logic apps",
    ].some((s) => t === s.toLowerCase()) ||
    (t.includes("eventbridge") && t.includes("scheduler"))
  )
    return "SCHEDULING";
  // Search
  if (
    [
      "elasticsearch",
      "opensearch",
      "typesense",
      "meilisearch",
      "algolia",
      "apache solr",
      "pinecone",
    ].some((s) => t === s.toLowerCase())
  )
    return "SEARCH ENGINES";
  // Client frameworks
  if (
    [
      "react",
      "next.js",
      "vue.js",
      "angular",
      "react native",
      "flutter",
      "swift/swiftui",
      "kotlin/jetpack compose",
    ].some((c) => t === c.toLowerCase())
  )
    return "CLIENT FRAMEWORKS";
  // Service frameworks
  if (
    t.includes("express") ||
    t.includes("fastify") ||
    t.includes("gin") ||
    t.includes("fiber") ||
    t.includes("spring boot") ||
    t.includes("fastapi") ||
    t.includes("django") ||
    t.includes("actix") ||
    t.includes("axum") ||
    t.includes("asp.net") ||
    t.includes("phoenix") ||
    t.includes("grpc service")
  )
    return "SERVICE FRAMEWORKS";

  return "OTHER";
}

/**
 * Generate the pricing.ts file from fetch results.
 * Groups technologies by category with comment headers.
 */
export async function generatePricingFile(results: FetchResult[]): Promise<void> {
  // Deduplicate: last result wins for each technology
  const byTech = new Map<string, TechnologyPricing>();
  for (const r of results) {
    byTech.set(r.technology, r.pricing);
  }

  // Group by category
  const grouped = new Map<string, Array<[string, TechnologyPricing]>>();
  for (const [tech, pricing] of byTech) {
    const cat = categorize(tech);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push([tech, pricing]);
  }

  // Sort within categories alphabetically
  for (const entries of grouped.values()) {
    entries.sort((a, b) => a[0].localeCompare(b[0]));
  }

  // Build output
  const sections: string[] = [];
  const now = new Date().toISOString().slice(0, 10);

  for (const cat of CATEGORY_ORDER) {
    const entries = grouped.get(cat);
    if (!entries || entries.length === 0) continue;
    grouped.delete(cat);
    const bar = "\u2500".repeat(76 - cat.length);
    sections.push(`\n  // \u2500\u2500\u2500 ${cat} ${bar}\n`);
    for (const [tech, pricing] of entries) {
      sections.push(renderPricing(tech, pricing));
    }
  }

  // Any uncategorized
  for (const [cat, entries] of grouped) {
    if (entries.length === 0) continue;
    const bar = "\u2500".repeat(76 - cat.length);
    sections.push(`\n  // \u2500\u2500\u2500 ${cat} ${bar}\n`);
    for (const [tech, pricing] of entries) {
      sections.push(renderPricing(tech, pricing));
    }
  }

  const output = `import type { TechnologyPricing } from "../types";

/**
 * Comprehensive pricing data for all technologies in the registry.
 * Keyed by technology name (must match TechnologyInfo.name exactly).
 *
 * Auto-generated by scripts/pricing/run.ts on ${now}.
 * All prices USD, US East regions unless noted.
 * Always verify against official pricing pages before making purchasing decisions.
 */
export const PRICING: Record<string, TechnologyPricing> = {${sections.join("\n")}
};
`;

  await writeFile(OUTPUT_PATH, output, "utf-8");
  log(`Generated ${OUTPUT_PATH} (${byTech.size} technologies)`);
}
