import type { DesignJSON } from "../db/io";
import type { ComponentType, SystemNodeData } from "../types";
import type { BundleCredential } from "./secrets";
import type { ServiceUrl } from "./lifecycle";

/**
 * Component types that are intentionally NOT deployed by the local-deploy
 * bundle. They still appear in the design and in Terraform/CDK/K8s exports,
 * but here they show up only as documentation so a reader can still see
 * what the production system was meant to look like.
 */
const EXCLUDED_TIER: ComponentType[] = [
  "api-gateway",
  "load-balancer",
  "cdn",
  "dns",
  "firewall",
  "client",
];

const TIER_LABELS: Record<string, string> = {
  "api-gateway": "API Gateways",
  "load-balancer": "Load Balancers",
  cdn: "CDNs",
  dns: "DNS",
  firewall: "Firewalls",
  client: "Clients",
};

export function buildReadme(
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
  urls: ServiceUrl[],
  credentials: BundleCredential[],
): string {
  const sections: string[] = [];

  sections.push(`# ${design.name} — local stack

A locally-runnable bundle of the design's compute, data, messaging,
and automation tiers. Edge components (API gateway, LB, CDN, DNS,
firewall, client) are documented at the bottom but not deployed.
`);

  sections.push(prerequisitesSection());
  sections.push(quickstartSection());
  sections.push(urlsSection(urls));
  sections.push(credentialsSection(credentials));
  sections.push(troubleshootingSection());
  sections.push(productionOnlySection(design, serviceNameByNodeId));

  return sections.join("\n\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function prerequisitesSection(): string {
  return `## Prerequisites

- Docker 25+ with Compose v2 (\`docker compose\` subcommand)
- macOS / Linux shell with \`bash\`, \`curl\`
- ~4 GB free RAM if you boot the full stack`;
}

function quickstartSection(): string {
  return `## Quickstart

\`\`\`bash
./start.sh    # boots compose, waits for health, prints URLs
./stop.sh     # halts compose, kills background CLI processes
./reset.sh    # wipes data volumes — destructive
\`\`\`

Random secrets live in \`.env\`. Compose entries reference them via
\`\${VAR}\`; do not commit \`.env\` to source control.`;
}

function urlsSection(urls: ServiceUrl[]): string {
  if (!urls.length) return "";
  const rows = urls.map((u) => `| \`${u.label}\` | ${u.url} |`).join("\n");
  return `## Service URLs

| Service | URL |
| --- | --- |
${rows}`;
}

function credentialsSection(credentials: BundleCredential[]): string {
  if (!credentials.length) return "";
  const rows = credentials
    .map((c) => `| \`${c.serviceName}\` | ${c.kind} | \`${c.user}\` | \`${c.passwordVar}\` |`)
    .join("\n");
  return `## Credentials

Passwords are random per export and live in \`.env\`. Each row points
at the var name to copy.

| Service | Kind | User | Password var |
| --- | --- | --- | --- |
${rows}`;
}

function troubleshootingSection(): string {
  return `## Troubleshooting

- A health check timed out → check \`docker compose logs <service>\`.
- Port collisions → \`./start.sh\` won't run. Stop the colliding
  process or edit the port mapping in \`docker-compose.yaml\`.
- "no space left on device" → \`./reset.sh\` to wipe volumes, or
  \`docker system prune -a --volumes\`.`;
}

function productionOnlySection(
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
): string {
  const grouped = new Map<ComponentType, Array<{ name: string; data: SystemNodeData }>>();
  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    if (!EXCLUDED_TIER.includes(data.componentType)) continue;
    const list = grouped.get(data.componentType) ?? [];
    list.push({ name: serviceNameByNodeId.get(node.id) ?? data.label, data });
    grouped.set(data.componentType, list);
  }
  if (grouped.size === 0) return "";

  const blocks: string[] = [
    `## Production-only components

These components appear in the design and in Terraform / CDK / K8s
exports, but the local bundle does not stand them up — they have no
meaningful behavior on \`localhost\` (TLS termination, geo-routing,
WAF, segmentation).`,
  ];
  for (const tier of EXCLUDED_TIER) {
    const items = grouped.get(tier);
    if (!items?.length) continue;
    blocks.push(`### ${TIER_LABELS[tier]}\n`);
    for (const item of items) {
      blocks.push(renderProductionItem(item.name, item.data));
    }
  }
  return blocks.join("\n");
}

function renderProductionItem(name: string, data: SystemNodeData): string {
  const lines: string[] = [`**${name}**`];
  if (data.plan?.technology) lines.push(`- technology: ${data.plan.technology}`);
  for (const [key, value] of Object.entries(data.plan ?? {})) {
    if (key === "technology" || !value) continue;
    lines.push(`- ${key}: ${value}`);
  }
  if (data.endpoints?.length) {
    lines.push(`- endpoints:`);
    for (const ep of data.endpoints) lines.push(`  - \`${ep.method} ${ep.path}\``);
  }
  return lines.join("\n") + "\n";
}
