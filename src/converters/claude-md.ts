import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { resolveTechId } from "./iac-mapping";

/**
 * Per-scaffolded-service info the generator needs to talk about runtime
 * conventions and per-service test commands.
 */
export interface ScaffoldedServiceMeta {
  /** Tech id resolved for the node — we map this back to a runtime label. */
  techId: string;
  testCommand: string;
}

/**
 * Generate a CLAUDE.md tailored to the bundle so a Claude Code session
 * dropped into the exported project knows the layout, commands, and
 * service map without re-deriving it from compose + filesystem.
 *
 * Pure function of the same inputs README + lifecycle already use, plus
 * a per-scaffold map so we can name runtimes and per-service test cmds.
 */
export function buildClaudeMd(
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
  hostPortByNodeId: Map<string, number[]>,
  scaffoldedByNodeId: Map<string, ScaffoldedServiceMeta>,
): string {
  const sections = [
    headerSection(),
    whatThisIsSection(design, scaffoldedByNodeId.size > 0),
    commandsSection(design, serviceNameByNodeId, scaffoldedByNodeId),
    architectureSection(design, serviceNameByNodeId, hostPortByNodeId, scaffoldedByNodeId),
    dataFlowSection(design, serviceNameByNodeId),
    conventionsSection(design, serviceNameByNodeId, scaffoldedByNodeId),
  ].filter(Boolean);

  return (
    sections
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

function headerSection(): string {
  return `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.`;
}

function whatThisIsSection(design: DesignJSON, hasScaffolded: boolean): string {
  const scaffoldNote = hasScaffolded
    ? " Scaffolded services ship with health endpoints only — business logic needs to be implemented."
    : "";
  return `## What This Is

A Docker Compose local stack for ${design.name}.${scaffoldNote}`;
}

function commandsSection(
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
  scaffoldedByNodeId: Map<string, ScaffoldedServiceMeta>,
): string {
  const lines: string[] = [
    "## Commands",
    "",
    "```bash",
    "./start.sh                # Boot full stack, wait for health checks, print URLs",
    "./stop.sh                 # Halt compose and background processes",
    "./reset.sh                # Wipe data volumes (destructive) — needed after schema.sql changes",
    "./test.sh                 # Run all service test suites via Docker (no deps, isolated)",
    "```",
  ];

  const scaffoldedNames: Array<{ name: string; cmd: string }> = [];
  for (const node of design.nodes) {
    const meta = scaffoldedByNodeId.get(node.id);
    const name = serviceNameByNodeId.get(node.id);
    if (meta && name) scaffoldedNames.push({ name, cmd: meta.testCommand });
  }
  if (scaffoldedNames.length > 0) {
    lines.push("", "Test a single service:", "```bash");
    for (const s of scaffoldedNames) {
      lines.push(`docker compose run --rm --no-deps ${s.name} ${s.cmd}`);
    }
    lines.push("```");
  }

  return lines.join("\n");
}

function architectureSection(
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
  hostPortByNodeId: Map<string, number[]>,
  scaffoldedByNodeId: Map<string, ScaffoldedServiceMeta>,
): string {
  const lines: string[] = ["## Architecture"];
  const services = servicesBlock(
    design,
    serviceNameByNodeId,
    hostPortByNodeId,
    scaffoldedByNodeId,
  );
  if (services) lines.push("", services);
  const infra = infrastructureBlock(design, serviceNameByNodeId, hostPortByNodeId);
  if (infra) lines.push("", infra);
  if (lines.length === 1) return "";
  return lines.join("\n");
}

function servicesBlock(
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
  hostPortByNodeId: Map<string, number[]>,
  scaffoldedByNodeId: Map<string, ScaffoldedServiceMeta>,
): string {
  const items: string[] = [];
  // Track runtimes seen so we can summarize in the section heading.
  const runtimes = new Set<string>();

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    if (data.componentType !== "service" && data.componentType !== "serverless") continue;
    const name = serviceNameByNodeId.get(node.id);
    if (!name) continue;

    const port = hostPortByNodeId.get(node.id)?.[0];
    const meta = scaffoldedByNodeId.get(node.id);
    if (meta) runtimes.add(runtimeLabel(meta.techId));

    const desc = (data.description ?? "").trim().replace(/\s+/g, " ");
    const targets = outgoingTargetNames(node.id, design, serviceNameByNodeId);
    const connectsTo = targets.length ? ` Connects to ${joinList(targets.map(code))}.` : "";
    const portSuffix = port != null ? ` (:${port})` : "";
    const descSuffix = desc ? ` — ${desc}.` : "";
    items.push(`- **${name}**${portSuffix}${descSuffix}${connectsTo}`);
  }
  if (items.length === 0) return "";

  const heading = runtimes.size > 0 ? `### Services (${[...runtimes].join(", ")})` : "### Services";
  return [heading, "", ...items].join("\n");
}

function infrastructureBlock(
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
  hostPortByNodeId: Map<string, number[]>,
): string {
  const items: string[] = [];
  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    if (data.componentType === "service" || data.componentType === "serverless") continue;
    const name = serviceNameByNodeId.get(node.id);
    if (!name) continue;

    const techId = resolveTechId(data.componentType, data.plan?.technology ?? "", "docker");
    const port = hostPortByNodeId.get(node.id)?.[0];
    const portSuffix = port != null ? ` (:${port})` : "";
    const techLabel = data.plan?.technology || prettyTechId(techId);
    const init = initNote(data.componentType, techId, name);
    items.push(`- **${name}**${portSuffix} — ${techLabel}.${init}`);
  }
  if (items.length === 0) return "";
  return ["### Infrastructure", "", ...items].join("\n");
}

function initNote(
  componentType: SystemNodeData["componentType"],
  techId: string,
  name: string,
): string {
  if (componentType === "database" && (techId === "postgresql" || techId === "mysql")) {
    return ` Schema in \`init/${name}/schema.sql\` — re-run \`./reset.sh\` + \`./start.sh\` after edits.`;
  }
  if (componentType === "cron") {
    return ` Schedule in \`init/${name}/config.ini\`.`;
  }
  return "";
}

function dataFlowSection(design: DesignJSON, serviceNameByNodeId: Map<string, string>): string {
  const lines: string[] = [];
  for (const edge of design.edges) {
    const src = serviceNameByNodeId.get(edge.source);
    const dst = serviceNameByNodeId.get(edge.target);
    if (!src || !dst) continue;
    const label =
      typeof edge.label === "string" && edge.label.trim()
        ? `--${edge.label.trim().replace(/\s+/g, "-")}-->`
        : "-->";
    lines.push(`${src} ${label} ${dst}`);
  }
  if (lines.length === 0) return "";
  return ["## Data Flow", "", "```", ...lines, "```"].join("\n");
}

function conventionsSection(
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
  scaffoldedByNodeId: Map<string, ScaffoldedServiceMeta>,
): string {
  const bullets: string[] = [];
  const hasNode = [...scaffoldedByNodeId.values()].some(
    (m) => runtimeLabel(m.techId) === "Node.js",
  );
  const hasPython = [...scaffoldedByNodeId.values()].some(
    (m) => runtimeLabel(m.techId) === "Python (FastAPI)",
  );
  const hasGo = [...scaffoldedByNodeId.values()].some((m) => runtimeLabel(m.techId) === "Go");

  if (hasNode) {
    bullets.push(
      "Each Node.js service exports `makeHandler()` from `src/index.js`. The CLI entrypoint guard prevents the server from starting during test imports.",
    );
  }
  if (hasPython) {
    bullets.push(
      "Each Python service exports `app` from `src/main.py` (FastAPI). Tests use pytest + httpx against the in-process app.",
    );
  }
  if (hasGo) {
    bullets.push(
      "Each Go service exposes its `http.Handler` via `NewHandler()` in `internal/handler`. Tests use the stdlib `httptest`.",
    );
  }
  if (scaffoldedByNodeId.size > 0) {
    bullets.push(
      "Add runtime dependencies to the per-service manifest (`package.json` / `requirements.txt` / `go.mod`); they install during the next `docker compose build`.",
    );
  }

  const hasDb = [...serviceNameByNodeId.entries()].some(([nodeId]) => {
    const node = design.nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== "system") return false;
    return (node.data as SystemNodeData).componentType === "database";
  });
  if (hasDb) {
    bullets.push(
      "Database credentials live in `.env` (auto-generated, do not commit). Services receive them via compose env: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DATABASE_URL`.",
    );
  }
  const hasRedis = [...serviceNameByNodeId.entries()].some(([nodeId]) => {
    const node = design.nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== "system") return false;
    const data = node.data as SystemNodeData;
    if (data.componentType !== "cache" && data.componentType !== "message-queue") return false;
    return resolveTechId(data.componentType, data.plan?.technology ?? "", "docker") === "redis";
  });
  if (hasRedis) {
    bullets.push("Redis connection string is exposed as `REDIS_URL`.");
  }

  if (bullets.length === 0) return "";
  return ["## Conventions", "", ...bullets.map((b) => `- ${b}`)].join("\n");
}

function outgoingTargetNames(
  nodeId: string,
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
): string[] {
  const names: string[] = [];
  for (const e of design.edges) {
    if (e.source !== nodeId) continue;
    const n = serviceNameByNodeId.get(e.target);
    if (n) names.push(n);
  }
  return names;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function code(s: string): string {
  return `\`${s}\``;
}

function runtimeLabel(techId: string): string {
  if (techId === "python-fastapi") return "Python (FastAPI)";
  if (techId === "go") return "Go";
  return "Node.js";
}

function prettyTechId(techId: string): string {
  if (!techId) return "service";
  return techId
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
