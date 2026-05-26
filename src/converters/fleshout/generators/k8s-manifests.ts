/**
 * Kubernetes manifests for a container-orchestration node.
 *
 * The orchestration node represents the cluster; the services that
 * connect to it (via outbound edges) become Deployments + Services
 * inside it. HPA defaults to autoscale based on the resources hint.
 */

import yaml from "js-yaml";
import type { Generator, GeneratorContext, GeneratedFile } from "../types";

export const k8sManifestGenerator: Generator = {
  kind: "deterministic",
  supports: (ctx) => ctx.node.componentType === "container-orchestration",
  async generate(ctx): Promise<GeneratedFile[]> {
    const p = ctx.node.plan ?? {};
    const namespace = (p.namespace || "default").replace(/\s+/g, "-");
    const replicas = parseInt((p.clusterSize || "3").replace(/[^\d]/g, ""), 10) || 3;
    const resources = parseResources(p.resources);

    const files: GeneratedFile[] = [];

    files.push({
      path: "namespace.yaml",
      contents: yaml.dump({
        apiVersion: "v1",
        kind: "Namespace",
        metadata: { name: namespace },
      }),
    });

    // For each connected service (outbound from the orchestration node),
    // generate a Deployment + Service + HPA.
    for (const out of ctx.outbound) {
      const name = slug(out.otherNodeLabel);
      const deployment = {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: { name, namespace },
        spec: {
          replicas,
          selector: { matchLabels: { app: name } },
          template: {
            metadata: { labels: { app: name } },
            spec: {
              containers: [
                {
                  name,
                  // TODO: image is unknown at flesh-out time — caller must
                  // override. We emit a placeholder that fails fast.
                  image: `TODO-${name}:latest`,
                  resources: {
                    requests: resources.requests,
                    limits: resources.limits,
                  },
                  ports: [{ containerPort: 8080 }],
                  readinessProbe: {
                    httpGet: { path: "/health", port: 8080 },
                    periodSeconds: 10,
                  },
                },
              ],
            },
          },
          strategy: {
            type: (p.deployStrategy || "RollingUpdate").includes("blue") ? "Recreate" : "RollingUpdate",
          },
        },
      };
      const service = {
        apiVersion: "v1",
        kind: "Service",
        metadata: { name, namespace },
        spec: {
          selector: { app: name },
          ports: [{ port: 80, targetPort: 8080 }],
        },
      };
      const hpa = {
        apiVersion: "autoscaling/v2",
        kind: "HorizontalPodAutoscaler",
        metadata: { name: `${name}-hpa`, namespace },
        spec: {
          scaleTargetRef: { apiVersion: "apps/v1", kind: "Deployment", name },
          minReplicas: Math.max(1, Math.floor(replicas / 2)),
          maxReplicas: replicas * 3,
          metrics: [
            {
              type: "Resource",
              resource: { name: "cpu", target: { type: "Utilization", averageUtilization: 70 } },
            },
          ],
        },
      };
      files.push({
        path: `${name}.yaml`,
        contents:
          [deployment, service, hpa].map((d) => yaml.dump(d)).join("---\n"),
      });
    }

    if (files.length === 1) {
      // Only the namespace was generated. Note it.
      files.push({
        path: "README.md",
        contents:
          `# ${ctx.node.label}\n\nNo service edges connected — connect services on the canvas to generate per-service Deployments, Services, and HPAs.\n`,
      });
    }

    return files;
  },
};

function parseResources(s: string | undefined): {
  requests: { cpu: string; memory: string };
  limits: { cpu: string; memory: string };
} {
  // "2 vCPU, 4 GB per pod" → cpu=2000m, memory=4Gi
  const cpu = (s?.match(/([\d.]+)\s*v?CPU/i)?.[1] ?? "0.5") + "";
  const mem = s?.match(/([\d.]+)\s*(Gi|MB|GB|Mi)/i);
  const memVal = mem ? (mem[1] + (mem[2].toLowerCase().startsWith("g") ? "Gi" : "Mi")) : "512Mi";
  return {
    requests: { cpu: `${parseFloat(cpu) * 1000}m`, memory: memVal },
    limits: { cpu: `${parseFloat(cpu) * 1000 * 2}m`, memory: memVal },
  };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
