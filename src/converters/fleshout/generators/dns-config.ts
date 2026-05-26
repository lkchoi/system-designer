/**
 * DNS config generator. Emits Route53 RecordSetGroup CFN + a zone-file
 * snippet. Plan: domain, recordTypes, routingPolicy, ttl.
 */

import type { Generator, GeneratorContext, GeneratedFile } from "../types";

export const dnsConfigGenerator: Generator = {
  kind: "deterministic",
  supports: (ctx) => ctx.node.componentType === "dns",
  async generate(ctx): Promise<GeneratedFile[]> {
    const p = ctx.node.plan ?? {};
    const domain = p.domain || "example.com.";
    const recordTypes = (p.recordTypes || "A")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const ttl = parseInt((p.ttl || "300").replace(/[^\d]/g, ""), 10) || 300;
    const policy = (p.routingPolicy || "simple").toLowerCase();

    const records = recordTypes.map((t) => ({
      Name: domain,
      Type: t,
      TTL: ttl,
      ResourceRecords: [t === "A" ? "203.0.113.10" : t === "CNAME" ? "example.cdn.net." : "ns1.example.com."],
      // TODO: replace with real values; placeholders for now.
      ...(policy.includes("weighted") || policy.includes("latency") || policy.includes("geo")
        ? { _todo: `non-simple routing policy "${p.routingPolicy}" not modeled in v1` }
        : {}),
    }));

    const cfn = {
      Resources: {
        Records: {
          Type: "AWS::Route53::RecordSetGroup",
          Properties: { HostedZoneName: domain, RecordSets: records },
        },
      },
    };

    const zone = [
      `; Zone file for ${domain}`,
      ...recordTypes.map((t) => `${domain} ${ttl} IN ${t} TODO_VALUE`),
    ].join("\n");

    return [
      { path: "route53.cfn.json", contents: JSON.stringify(cfn, null, 2) + "\n" },
      { path: "zone.txt", contents: zone + "\n" },
    ];
  },
};
