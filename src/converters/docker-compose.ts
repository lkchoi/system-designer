import yaml from "js-yaml";
import type { ConverterModule, ExportResult } from "./types";
import type { DesignJSON } from "../db/io";
import type { ComponentType, SystemNodeData } from "../types";
import {
  allocateHostPort,
  getDefaultMapping,
  getDefaultPorts,
  getResourceMapping,
  resolveTechId,
} from "./iac-mapping";
import { exportBundle, type BundleFile } from "./bundle";
import { buildServiceEnv } from "./wiring";
import { generateSecrets } from "./secrets";
import { buildLifecycleScripts, urlsFor } from "./lifecycle";
import { buildReadme } from "./readme";

/** Component types whose nodes are not deployed by the local-deploy bundle. */
const EXCLUDED_TIER: ReadonlySet<ComponentType> = new Set([
  "api-gateway",
  "load-balancer",
  "cdn",
  "dns",
  "firewall",
  "client",
]);

function sanitizeName(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^[^a-z]/, "s$&") || "service"
  );
}

interface DeployableNode {
  nodeId: string;
  name: string;
  data: SystemNodeData;
  techId: string;
  image?: string;
  buildContext?: string;
  containerPorts: number[];
  hostPorts: number[];
}

async function exportToBundle(design: DesignJSON): Promise<ExportResult> {
  // 1) Resolve names + image + ports for every deployable node.
  const usedNames = new Set<string>();
  const usedHostPorts = new Set<number>();
  const deployables: DeployableNode[] = [];
  const serviceNameByNodeId = new Map<string, string>();
  const hostPortByNodeId = new Map<string, number[]>();

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    if (EXCLUDED_TIER.has(data.componentType)) continue;

    const techId = resolveTechId(data.componentType, data.plan?.technology ?? "");
    const mapping =
      getResourceMapping(data.componentType, techId) ?? getDefaultMapping(data.componentType);

    // Skip nodes that have neither a mapping nor a user image/buildContext —
    // there's nothing to deploy.
    const image = data.image || mapping?.docker;
    const buildContext = data.buildContext;
    if (!image && !buildContext) continue;

    let name = sanitizeName(data.label);
    while (usedNames.has(name)) name += "-2";
    usedNames.add(name);
    serviceNameByNodeId.set(node.id, name);

    const containerPorts = getDefaultPorts(data.componentType, techId);
    const hostPorts = containerPorts.map((p) => allocateHostPort(p, usedHostPorts));
    hostPortByNodeId.set(node.id, hostPorts);

    deployables.push({
      nodeId: node.id,
      name,
      data,
      techId,
      image,
      buildContext,
      containerPorts,
      hostPorts,
    });
  }

  // 2) Generate secrets / .env file + per-container auth env.
  const secrets = generateSecrets(design, serviceNameByNodeId);

  // 3) Build the compose `services` dictionary.
  const services: Record<string, unknown> = {};
  const volumes: Record<string, unknown> = {};
  const serviceDescriptions = new Map<string, string>();

  for (const dep of deployables) {
    const entry: Record<string, unknown> = { restart: "unless-stopped" };
    if (dep.buildContext) entry.build = { context: dep.buildContext };
    else if (dep.image) entry.image = dep.image;

    if (dep.containerPorts.length > 0) {
      entry.ports = dep.containerPorts.map((c, i) => `${dep.hostPorts[i]}:${c}`);
    }

    // Compose env = container-auth env (from secrets) + image-required env
    // (search engine settings, kafka KRaft config) + edge-derived env (services).
    const envParts: Record<string, string | number>[] = [];
    const containerEnv = secrets.containerEnv.get(dep.nodeId);
    if (containerEnv) envParts.push(containerEnv);
    const imageEnv = imageEnvFor(dep);
    if (imageEnv) envParts.push(imageEnv);
    if (dep.data.componentType === "service" || dep.data.componentType === "serverless") {
      const sourceNode = design.nodes.find((n) => n.id === dep.nodeId);
      if (sourceNode) {
        const serviceEnv = buildServiceEnv(sourceNode, design, serviceNameByNodeId);
        if (Object.keys(serviceEnv).length > 0) envParts.push(serviceEnv);
      }
    }
    const merged = Object.assign({}, ...envParts);
    if (Object.keys(merged).length > 0) entry.environment = merged;

    // Volumes for stateful services so data survives compose recreation.
    if (needsDataVolume(dep.data.componentType, dep.techId)) {
      const volName = `${dep.name}-data`;
      entry.volumes = [`${volName}:${dataDirFor(dep.data.componentType, dep.techId)}`];
      volumes[volName] = {};
    }

    // Image-specific overrides (e.g. MinIO needs a custom command).
    const cmd = imageCommandFor(dep);
    if (cmd) entry.command = cmd;

    if (dep.data.description) serviceDescriptions.set(dep.name, dep.data.description);
    services[dep.name] = entry;
  }

  // 4) depends_on from edges (only between deployable nodes)
  for (const edge of design.edges) {
    const sourceName = serviceNameByNodeId.get(edge.source);
    const targetName = serviceNameByNodeId.get(edge.target);
    if (!sourceName || !targetName || !services[sourceName]) continue;
    const svc = services[sourceName] as Record<string, unknown>;
    const existing = (svc.depends_on as string[] | undefined) ?? [];
    if (!existing.includes(targetName)) {
      svc.depends_on = [...existing, targetName];
    }
  }

  const compose: Record<string, unknown> = { services };
  if (Object.keys(volumes).length > 0) compose.volumes = volumes;
  let composeYaml = yaml.dump(compose, { lineWidth: 120, noRefs: true });
  // Inject service descriptions as comments above each service block.
  for (const [name, desc] of serviceDescriptions) {
    const marker = `  ${name}:\n`;
    const idx = composeYaml.indexOf(marker);
    if (idx === -1) continue;
    composeYaml = composeYaml.slice(0, idx) + `  # ${desc}\n` + composeYaml.slice(idx);
  }

  // 5) Lifecycle scripts + README.
  const lifecycle = buildLifecycleScripts(design, serviceNameByNodeId, hostPortByNodeId);
  const urls = deployables.flatMap((dep) =>
    urlsFor(dep.data.componentType, dep.techId, dep.name, dep.hostPorts),
  );
  const readme = buildReadme(design, serviceNameByNodeId, urls, secrets.credentials);

  // 6) Pack into a zip bundle.
  const files: BundleFile[] = [
    { path: "docker-compose.yaml", content: composeYaml },
    { path: ".env", content: secrets.envFileContent },
    { path: "README.md", content: readme },
    { path: "start.sh", content: lifecycle.startSh, executable: true },
    { path: "stop.sh", content: lifecycle.stopSh, executable: true },
    { path: "reset.sh", content: lifecycle.resetSh, executable: true },
  ];
  return exportBundle(files, "local-stack");
}

function needsDataVolume(componentType: ComponentType, techId: string): boolean {
  if (componentType === "database") return techId !== "dynamodb";
  if (componentType === "storage") return true;
  if (componentType === "search-engine") return true;
  if (componentType === "data-warehouse") return true;
  if (componentType === "message-queue" && techId === "rabbitmq") return true;
  return false;
}

function dataDirFor(componentType: ComponentType, techId: string): string {
  if (componentType === "database") {
    if (techId === "mongodb") return "/data/db";
    if (techId === "mysql" || techId === "mariadb") return "/var/lib/mysql";
    if (techId === "cassandra") return "/var/lib/cassandra";
    return "/var/lib/postgresql/data";
  }
  if (componentType === "storage") return "/data";
  if (componentType === "search-engine") return "/usr/share/elasticsearch/data";
  if (componentType === "data-warehouse") return "/var/lib/clickhouse";
  if (componentType === "message-queue" && techId === "rabbitmq") return "/var/lib/rabbitmq";
  return "/data";
}

function imageEnvFor(dep: DeployableNode): Record<string, string | number> | null {
  if (dep.data.componentType === "search-engine") {
    return {
      "discovery.type": "single-node",
      "xpack.security.enabled": "false",
    };
  }
  if (dep.data.componentType === "message-queue" && dep.techId === "kafka") {
    return {
      KAFKA_PROCESS_ROLES: "broker,controller",
      KAFKA_NODE_ID: 1,
      KAFKA_LISTENERS: "PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093",
      KAFKA_ADVERTISED_LISTENERS: `PLAINTEXT://${dep.name}:9092`,
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: "PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT",
      KAFKA_INTER_BROKER_LISTENER_NAME: "PLAINTEXT",
      KAFKA_CONTROLLER_LISTENER_NAMES: "CONTROLLER",
      KAFKA_CONTROLLER_QUORUM_VOTERS: "1@localhost:9093",
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1,
      CLUSTER_ID: "MkU3OEVBNTcwNTJENDM2Qk",
    };
  }
  return null;
}

function imageCommandFor(dep: DeployableNode): string | null {
  if (dep.data.componentType === "storage" && (dep.techId === "s3" || dep.techId === "minio")) {
    return "server /data --console-address ':9001'";
  }
  return null;
}

export const dockerComposeConverter: ConverterModule = {
  id: "docker-compose",
  label: "Docker Compose",
  description: "Local-deploy bundle (zip)",
  category: "iac",
  fileExtensions: [".zip"],
  canImport: false,

  exportDesign(design: DesignJSON): Promise<ExportResult> {
    return exportToBundle(design);
  },
};
