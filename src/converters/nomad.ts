import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { getResourceMapping, getDefaultMapping } from "./iac-mapping";

function sanitizeName(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^[^a-z]/, "j$&") || "job"
  );
}

function exportToNomad(design: DesignJSON): string {
  const groups: unknown[] = [];
  const usedNames = new Set<string>();

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    const tech = data.plan?.technology ?? "";
    const mapping =
      getResourceMapping(data.componentType, tech) ?? getDefaultMapping(data.componentType);
    if (!mapping?.docker) continue;

    let name = sanitizeName(data.label);
    while (usedNames.has(name)) name += "-2";
    usedNames.add(name);

    groups.push(buildGroup(name, mapping.docker, data));
  }

  const jobName = sanitizeName(design.name);
  const job = {
    job: {
      [jobName]: [
        {
          datacenters: ["dc1"],
          type: "service",
          group: groups.reduce((acc, g) => ({ ...acc, ...(g as object) }), {}),
        },
      ],
    },
  };

  return JSON.stringify(job, null, 2);
}

function buildGroup(name: string, image: string, data: SystemNodeData): unknown {
  const port =
    data.componentType === "database" ? 5432 : data.componentType === "cache" ? 6379 : 8080;
  const replicas = parseInt(data.plan?.replicas ?? "1", 10) || 1;

  return {
    [name]: [
      {
        count: replicas,
        network: [{ port: { http: [{ static: port }] } }],
        service: [
          {
            name,
            port: "http",
            check: [{ type: "tcp", interval: "10s", timeout: "2s" }],
          },
        ],
        task: {
          [name]: [
            {
              driver: "docker",
              config: [{ image, ports: ["http"] }],
              resources: [{ cpu: 256, memory: 512 }],
            },
          ],
        },
      },
    ],
  };
}

export const nomadConverter: ConverterModule = {
  id: "nomad",
  label: "Nomad",
  description: "HashiCorp Nomad job spec",
  category: "iac",
  fileExtensions: [".nomad.json", ".json"],
  canImport: false,

  exportDesign(design: DesignJSON) {
    return {
      content: exportToNomad(design),
      filename: `${design.name}.nomad.json`,
      mimeType: "application/json",
    };
  },
};
