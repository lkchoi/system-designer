/**
 * CDN distribution config. Emits a CloudFront distribution CFN.
 * Plan: origins, cacheRules, edgeLocations.
 */

import type { Generator, GeneratedFile } from "../types";

export const cdnConfigGenerator: Generator = {
  kind: "deterministic",
  supports: (ctx) => ctx.node.componentType === "cdn",
  async generate(ctx): Promise<GeneratedFile[]> {
    const p = ctx.node.plan ?? {};
    const origins = (p.origins || "").split(",").map((s) => s.trim()).filter(Boolean);
    const cacheRules = (p.cacheRules || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const cfnOrigins = origins.map((host, i) => ({
      Id: `origin-${i}`,
      DomainName: host,
      CustomOriginConfig: { OriginProtocolPolicy: "https-only" },
    }));

    const behaviors = cacheRules.map((rule, i) => {
      // "static/* 30d" → path: static/*, ttl: 30d
      const m = rule.match(/^(\S+)\s+(.+)$/);
      const path = m?.[1] ?? rule;
      const ttl = m?.[2] ?? "1h";
      return {
        PathPattern: path,
        TargetOriginId: `origin-${Math.min(i, origins.length - 1)}`,
        ViewerProtocolPolicy: "redirect-to-https",
        DefaultTTL: durationToSeconds(ttl),
      };
    });

    const cfn = {
      Resources: {
        Distribution: {
          Type: "AWS::CloudFront::Distribution",
          Properties: {
            DistributionConfig: {
              Enabled: true,
              Origins:
                cfnOrigins.length > 0
                  ? cfnOrigins
                  : [
                      {
                        Id: "origin-0",
                        DomainName: "todo-origin.example.com",
                        CustomOriginConfig: { OriginProtocolPolicy: "https-only" },
                      },
                    ],
              DefaultCacheBehavior: {
                TargetOriginId: "origin-0",
                ViewerProtocolPolicy: "redirect-to-https",
                DefaultTTL: 3600,
              },
              CacheBehaviors: behaviors.length > 0 ? behaviors : undefined,
              PriceClass: p.edgeLocations?.toLowerCase().includes("global")
                ? "PriceClass_All"
                : "PriceClass_100",
            },
          },
        },
      },
    };
    return [{ path: "distribution.cfn.json", contents: JSON.stringify(cfn, null, 2) + "\n" }];
  },
};

function durationToSeconds(d: string): number {
  const m = d.match(/(\d+)\s*([smhd])/i);
  if (!m) return 3600;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  return unit === "s" ? n : unit === "m" ? n * 60 : unit === "h" ? n * 3600 : n * 86400;
}
