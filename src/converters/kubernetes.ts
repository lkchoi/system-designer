import yaml from "js-yaml";
import type { Node } from "@xyflow/react";
import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData, ComponentType } from "../types";
import { getResourceMapping, getDefaultMapping, k8sToComponentType } from "./iac-mapping";

function sanitizeName(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^[^a-z]/, "r$&") || "resource"
  );
}

function exportToK8s(design: DesignJSON): string {
  const docs: unknown[] = [];
  const usedNames = new Set<string>();

  // Create namespace
  const namespace = sanitizeName(design.name);
  docs.push({
    apiVersion: "v1",
    kind: "Namespace",
    metadata: { name: namespace },
  });

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    const tech = data.plan?.technology ?? "";
    const mapping =
      getResourceMapping(data.componentType, tech) ?? getDefaultMapping(data.componentType);
    if (!mapping?.k8s) continue;

    let name = sanitizeName(data.label);
    while (usedNames.has(name)) name += "-2";
    usedNames.add(name);

    const image = mapping.docker ?? "busybox:latest"; // TODO: use actual image
    const k8s = mapping.k8s;

    if (k8s.kind === "Deployment" || k8s.kind === "StatefulSet") {
      docs.push(buildWorkload(k8s.kind, k8s.apiVersion, name, namespace, image, data));
      docs.push(buildService(name, namespace));
    } else if (k8s.kind === "Ingress") {
      docs.push(buildIngress(name, namespace, data));
    } else if (k8s.kind === "CronJob") {
      docs.push(buildCronJob(name, namespace, image, data));
    } else if (k8s.kind === "NetworkPolicy") {
      docs.push(buildNetworkPolicy(name, namespace));
    }
  }

  return docs.map((doc) => yaml.dump(doc, { lineWidth: 120, noRefs: true })).join("---\n");
}

function buildWorkload(
  kind: string,
  apiVersion: string,
  name: string,
  namespace: string,
  image: string,
  data: SystemNodeData,
): unknown {
  const replicas = parseInt(data.plan?.replicas ?? "1", 10) || 1;
  return {
    apiVersion,
    kind,
    metadata: {
      name,
      namespace,
      labels: { app: name, "system-designer/component-type": data.componentType },
    },
    spec: {
      replicas,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: {
          containers: [
            {
              name,
              image,
              ports: [{ containerPort: 8080 }], // TODO: configure port
              resources: {
                requests: { memory: "128Mi", cpu: "100m" },
                limits: { memory: "512Mi", cpu: "500m" },
              },
            },
          ],
        },
      },
    },
  };
}

function buildService(name: string, namespace: string): unknown {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name, namespace },
    spec: {
      selector: { app: name },
      ports: [{ port: 80, targetPort: 8080, protocol: "TCP" }],
      type: "ClusterIP",
    },
  };
}

function buildIngress(name: string, namespace: string, data: SystemNodeData): unknown {
  return {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: {
      name,
      namespace,
      labels: { "system-designer/component-type": data.componentType },
    },
    spec: {
      rules: [
        {
          host: "example.com", // TODO: configure host
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix",
                backend: { service: { name: "TODO-backend-service", port: { number: 80 } } },
              },
            ],
          },
        },
      ],
    },
  };
}

function buildCronJob(
  name: string,
  namespace: string,
  image: string,
  data: SystemNodeData,
): unknown {
  return {
    apiVersion: "batch/v1",
    kind: "CronJob",
    metadata: {
      name,
      namespace,
      labels: { "system-designer/component-type": data.componentType },
    },
    spec: {
      schedule: data.plan?.schedule ?? "0 * * * *", // TODO: configure
      jobTemplate: {
        spec: {
          template: {
            spec: {
              containers: [{ name, image, command: ["echo", "TODO: add job command"] }],
              restartPolicy: "OnFailure",
            },
          },
        },
      },
    },
  };
}

function buildNetworkPolicy(name: string, namespace: string): unknown {
  return {
    apiVersion: "networking.k8s.io/v1",
    kind: "NetworkPolicy",
    metadata: { name: `${name}-policy`, namespace },
    spec: {
      podSelector: {},
      policyTypes: ["Ingress", "Egress"],
      ingress: [{}], // TODO: configure rules
      egress: [{}],
    },
  };
}

function importFromK8s(content: string): DesignJSON {
  // Split multi-doc YAML
  const rawDocs = content.split(/^---$/m).filter((s) => s.trim());
  const nodes: Node[] = [];
  let x = 100;
  let y = 100;

  for (const raw of rawDocs) {
    const doc = yaml.load(raw) as Record<string, unknown> | null;
    if (!doc || typeof doc !== "object") continue;

    const kind = doc.kind as string;
    if (!kind || kind === "Namespace") continue;

    // Skip Service docs (they're companions to workloads)
    if (kind === "Service") continue;

    const match = k8sToComponentType(kind);
    const metadata = doc.metadata as { name?: string; labels?: Record<string, string> } | undefined;
    const name = metadata?.name ?? "resource";

    // Try to recover componentType from label
    const labelType = metadata?.labels?.["system-designer/component-type"] as
      | ComponentType
      | undefined;

    const componentType = labelType ?? match?.componentType ?? "service";
    const technologyId = match?.technologyId ?? "";

    const node: Node = {
      id: name,
      type: "system",
      position: { x, y },
      data: {
        label: name,
        componentType,
        status: "healthy",
        metrics: { cpu: 0, memory: 0, requestsPerSec: 0, latency: 0 },
        plan: technologyId ? { technology: technologyId } : {},
        sharded: false,
        shardKey: "",
        endpoints: [],
        capClassification: "",
        stressFailure: "none",
        capacityPercent: 100,
        consumerRate: 1000,
      },
    };

    nodes.push(node);
    x += 250;
    if (x > 1000) {
      x = 100;
      y += 200;
    }
  }

  return {
    version: 1,
    name: "Imported from Kubernetes",
    nodes,
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    flowPaths: [],
  };
}

export const kubernetesConverter: ConverterModule = {
  id: "kubernetes",
  label: "Kubernetes",
  description: "K8s manifests (YAML)",
  category: "iac",
  fileExtensions: [".yaml", ".yml"],
  canImport: true,

  exportDesign(design: DesignJSON) {
    return {
      content: exportToK8s(design),
      filename: `${design.name}-manifests.yaml`,
      mimeType: "text/yaml",
    };
  },

  importDesign(content: string) {
    return importFromK8s(content);
  },
};
