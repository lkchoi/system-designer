/**
 * Load balancer config generator.
 *
 * Emits an ALB-shaped CFN snippet and an nginx upstream block. Plan
 * fields: algorithm, healthCheck, targets, protocol.
 */

import type { Generator, GeneratedFile } from "../types";

export const lbConfigGenerator: Generator = {
  kind: "deterministic",
  supports: (ctx) => ctx.node.componentType === "load-balancer",
  async generate(ctx): Promise<GeneratedFile[]> {
    const p = ctx.node.plan ?? {};
    const algorithm = (p.algorithm || "round-robin").toLowerCase().replace(/\s+/g, "_");
    const targets = (p.targets || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const healthPath = parseHealthPath(p.healthCheck) || "/health";
    const proto = (p.protocol || "HTTP").toUpperCase();

    const cfn = {
      Resources: {
        TargetGroup: {
          Type: "AWS::ElasticLoadBalancingV2::TargetGroup",
          Properties: {
            Protocol: proto === "HTTPS" ? "HTTP" : proto, // TG is HTTP behind HTTPS LB
            Port: proto === "HTTPS" ? 443 : 80,
            HealthCheckPath: healthPath,
            HealthCheckIntervalSeconds: 10,
            TargetGroupAttributes: [
              {
                Key: "load_balancing.algorithm.type",
                Value: algorithm === "least_outstanding_requests" ? "least_outstanding_requests" : "round_robin",
              },
            ],
          },
        },
        Listener: {
          Type: "AWS::ElasticLoadBalancingV2::Listener",
          Properties: {
            Protocol: proto,
            Port: proto === "HTTPS" ? 443 : 80,
            DefaultActions: [{ Type: "forward", TargetGroupArn: { Ref: "TargetGroup" } }],
          },
        },
      },
    };

    const upstream = [
      `upstream ${slug(ctx.node.label)} {`,
      ...(algorithm.includes("least") ? [`  least_conn;`] : []),
      ...targets.map((t) => `  server ${t}:80;`),
      `}`,
      ``,
      `server {`,
      `  listen ${proto === "HTTPS" ? 443 : 80};`,
      `  location ${healthPath} { return 200; }`,
      `  location / {`,
      `    proxy_pass http://${slug(ctx.node.label)};`,
      `  }`,
      `}`,
    ].join("\n");

    return [
      { path: "lb.cfn.json", contents: JSON.stringify(cfn, null, 2) + "\n" },
      { path: "nginx.conf", contents: upstream + "\n" },
    ];
  },
};

function parseHealthPath(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const m = s.match(/(\/[^\s,]*)/);
  return m?.[1];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "backend";
}
