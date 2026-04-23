import yaml from "js-yaml";
import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { getResourceMapping, getDefaultMapping, resolveTechId } from "./iac-mapping";

/** Allocate a host port, incrementing if already taken. */
function allocatePort(preferred: number, used: Set<number>): number {
  let port = preferred;
  while (used.has(port)) port++;
  used.add(port);
  return port;
}

function sanitizeName(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^[^a-z]/, "s$&") || "service"
  );
}

function exportToCompose(design: DesignJSON): string {
  const services: Record<string, unknown> = {};
  const volumes: Record<string, unknown> = {};
  const usedNames = new Set<string>();

  // Build edge map for depends_on
  const dependsOn = new Map<string, string[]>();
  for (const edge of design.edges) {
    const deps = dependsOn.get(edge.source) ?? [];
    deps.push(edge.target);
    dependsOn.set(edge.source, deps);
  }

  const nodeNameMap = new Map<string, string>();
  const usedPorts = new Set<number>();
  const serviceDescriptions = new Map<string, string>();

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    const techName = data.plan?.technology ?? "";
    const techId = resolveTechId(data.componentType, techName);
    const mapping =
      getResourceMapping(data.componentType, techId) ?? getDefaultMapping(data.componentType);
    if (!mapping?.docker) continue;

    let name = sanitizeName(data.label);
    while (usedNames.has(name)) name += "-2";
    usedNames.add(name);
    nodeNameMap.set(node.id, name);

    const service: Record<string, unknown> = {
      image: mapping.docker,
      restart: "unless-stopped",
    };

    // Add ports and volumes based on component type
    if (data.componentType === "database") {
      const port =
        techId === "mongodb"
          ? 27017
          : techId === "cassandra"
            ? 9042
            : techId === "mysql" || techId === "mariadb"
              ? 3306
              : 5432;
      const hostPort = allocatePort(port, usedPorts);
      service.ports = [`${hostPort}:${port}`];
      const dataDir =
        techId === "mongodb"
          ? "mongo"
          : techId === "mysql" || techId === "mariadb"
            ? "mysql"
            : "postgresql/data";
      service.volumes = [`${name}-data:/var/lib/${dataDir}`];
      volumes[`${name}-data`] = {};

      if (techId === "postgresql" || techId === "cockroachdb") {
        service.environment = {
          POSTGRES_DB: "app",
          POSTGRES_USER: "admin",
          POSTGRES_PASSWORD: "changeme",
        };
      } else if (techId === "mysql" || techId === "mariadb") {
        service.environment = { MYSQL_DATABASE: "app", MYSQL_ROOT_PASSWORD: "changeme" };
      } else if (techId === "mongodb") {
        service.environment = {
          MONGO_INITDB_DATABASE: "app",
        };
      }
    } else if (data.componentType === "cache") {
      const hostPort = allocatePort(6379, usedPorts);
      service.ports = [`${hostPort}:6379`];
    } else if (data.componentType === "message-queue") {
      if (techId === "kafka") {
        const hostPort = allocatePort(9092, usedPorts);
        service.ports = [`${hostPort}:9092`];
        service.environment = {
          KAFKA_BROKER_ID: 1,
          KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1,
        };
      } else if (techId === "rabbitmq") {
        const p1 = allocatePort(5672, usedPorts);
        const p2 = allocatePort(15672, usedPorts);
        service.ports = [`${p1}:5672`, `${p2}:15672`];
      } else if (techId === "nats") {
        const hostPort = allocatePort(4222, usedPorts);
        service.ports = [`${hostPort}:4222`];
      } else if (techId === "redis") {
        const hostPort = allocatePort(6380, usedPorts);
        service.ports = [`${hostPort}:6379`];
      }
    } else if (data.componentType === "search-engine") {
      const hostPort = allocatePort(9200, usedPorts);
      service.ports = [`${hostPort}:9200`];
      service.environment = { "discovery.type": "single-node" };
    } else if (data.componentType === "storage") {
      const p1 = allocatePort(9000, usedPorts);
      const p2 = allocatePort(9001, usedPorts);
      service.ports = [`${p1}:9000`, `${p2}:9001`];
      service.command = "server /data --console-address ':9001'";
      service.volumes = [`${name}-data:/data`];
      volumes[`${name}-data`] = {};
    } else if (data.componentType === "api-gateway" || data.componentType === "load-balancer") {
      const p1 = allocatePort(80, usedPorts);
      const p2 = allocatePort(443, usedPorts);
      service.ports = [`${p1}:80`, `${p2}:443`];
    } else {
      const hostPort = allocatePort(8080, usedPorts);
      service.ports = [`${hostPort}:8080`];
    }

    const desc = (data as Record<string, unknown>).description as string | undefined;
    if (desc) serviceDescriptions.set(name, desc);

    services[name] = service;
  }

  // Add depends_on
  for (const [sourceId, targetIds] of dependsOn) {
    const sourceName = nodeNameMap.get(sourceId);
    if (!sourceName || !services[sourceName]) continue;
    const deps = targetIds
      .map((id) => nodeNameMap.get(id))
      .filter((n): n is string => n != null && services[n] != null);
    if (deps.length > 0) {
      (services[sourceName] as Record<string, unknown>).depends_on = deps;
    }
  }

  const compose: Record<string, unknown> = { services };
  if (Object.keys(volumes).length > 0) compose.volumes = volumes;

  let out = yaml.dump(compose, { lineWidth: 120, noRefs: true });

  // Inject description comments above each service
  for (const [name, desc] of serviceDescriptions) {
    const marker = `  ${name}:\n`;
    const idx = out.indexOf(marker);
    if (idx === -1) continue;
    const comment = `  # ${desc}\n`;
    out = out.slice(0, idx) + comment + out.slice(idx);
  }

  return out;
}

export const dockerComposeConverter: ConverterModule = {
  id: "docker-compose",
  label: "Docker Compose",
  description: "Container orchestration (YAML)",
  category: "iac",
  fileExtensions: [".yaml", ".yml"],
  canImport: false,

  exportDesign(design: DesignJSON) {
    return {
      content: exportToCompose(design),
      filename: `docker-compose.yaml`,
      mimeType: "text/yaml",
    };
  },
};
