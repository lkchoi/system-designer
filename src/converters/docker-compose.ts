import yaml from "js-yaml";
import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { getResourceMapping, getDefaultMapping } from "./iac-mapping";

function sanitizeName(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^[^a-z]/, "s$&") || "service";
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

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    const tech = data.plan?.technology ?? "";
    const mapping = getResourceMapping(data.componentType, tech) ?? getDefaultMapping(data.componentType);
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
      const port = tech === "mongodb" ? 27017 : tech === "cassandra" ? 9042 : 5432;
      service.ports = [`${port}:${port}`];
      service.volumes = [`${name}-data:/var/lib/${tech === "mongodb" ? "mongo" : tech === "mysql" ? "mysql" : "postgresql/data"}`];
      volumes[`${name}-data`] = {};

      if (tech === "postgresql" || tech === "mysql") {
        service.environment = {
          ...(tech === "postgresql"
            ? { POSTGRES_DB: "app", POSTGRES_USER: "admin", POSTGRES_PASSWORD: "changeme" }
            : { MYSQL_DATABASE: "app", MYSQL_ROOT_PASSWORD: "changeme" }),
        };
      }
    } else if (data.componentType === "cache") {
      service.ports = ["6379:6379"];
    } else if (data.componentType === "message-queue") {
      if (tech === "kafka") {
        service.ports = ["9092:9092"];
        service.environment = {
          KAFKA_BROKER_ID: 1,
          KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1,
        };
      } else if (tech === "rabbitmq") {
        service.ports = ["5672:5672", "15672:15672"];
      } else if (tech === "nats") {
        service.ports = ["4222:4222"];
      }
    } else if (data.componentType === "search-engine") {
      service.ports = ["9200:9200"];
      service.environment = { "discovery.type": "single-node" };
    } else if (data.componentType === "storage") {
      service.ports = ["9000:9000", "9001:9001"];
      service.command = "server /data --console-address ':9001'";
      service.volumes = [`${name}-data:/data`];
      volumes[`${name}-data`] = {};
    } else if (data.componentType === "api-gateway" || data.componentType === "load-balancer") {
      service.ports = ["80:80", "443:443"];
    } else {
      service.ports = ["8080:8080"];
    }

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

  return yaml.dump(compose, { lineWidth: 120, noRefs: true });
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
