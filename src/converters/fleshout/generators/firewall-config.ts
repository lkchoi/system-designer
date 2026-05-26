/**
 * Firewall config generator.
 *
 * Emits a CFN AWS::EC2::SecurityGroup + a WAF rule-set stub. The WAF
 * stub is a recommendation file flagged as TODO — we don't deploy waf
 * rules automatically because they're security-critical.
 */

import type { Generator, GeneratorContext, GeneratedFile } from "../types";

export const firewallConfigGenerator: Generator = {
  kind: "deterministic",
  supports: (ctx) => ctx.node.componentType === "firewall",
  async generate(ctx): Promise<GeneratedFile[]> {
    const p = ctx.node.plan ?? {};
    const inbound = (p.inboundRules || "").split(",").map((s) => s.trim()).filter(Boolean);
    const outbound = (p.outboundRules || "").split(",").map((s) => s.trim()).filter(Boolean);
    const allowedIPs = (p.allowedIPs || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const waf = p.waf || "";

    const ingress = inbound.map((rule) => parseRule(rule, allowedIPs));
    const egress =
      outbound.length === 0 || outbound[0]?.toLowerCase().includes("all")
        ? [{ IpProtocol: "-1", CidrIp: "0.0.0.0/0" }]
        : outbound.map((rule) => parseRule(rule, ["0.0.0.0/0"]));

    const cfn = {
      Resources: {
        SecurityGroup: {
          Type: "AWS::EC2::SecurityGroup",
          Properties: {
            GroupDescription: ctx.node.label,
            SecurityGroupIngress: ingress,
            SecurityGroupEgress: egress,
          },
        },
      },
    };

    const wafDoc = [
      `# ${ctx.node.label} — WAF rules (review before applying)`,
      ``,
      `**These rules are recommendations, not auto-deployed**. Review and integrate`,
      `into your AWS WAF / Cloudflare / CDN WAF deployment manually.`,
      ``,
      `**Requested rule set**: ${waf || "(none)"}`,
      ``,
      waf.toLowerCase().includes("owasp")
        ? [
            `## OWASP Top 10 mappings`,
            `- SQLi: enable \`AWS-AWSManagedRulesSQLiRuleSet\` (or equivalent)`,
            `- XSS: enable \`AWS-AWSManagedRulesCommonRuleSet\``,
            `- Bad bots: enable \`AWS-AWSManagedRulesBotControlRuleSet\``,
            `- IP reputation: enable \`AWS-AWSManagedRulesAmazonIpReputationList\``,
          ].join("\n")
        : ``,
      ``,
    ].join("\n");

    return [
      { path: "security-group.cfn.json", contents: JSON.stringify(cfn, null, 2) + "\n" },
      { path: "waf-rules.md", contents: wafDoc },
    ];
  },
};

function parseRule(
  raw: string,
  cidrs: string[],
): { IpProtocol: string; FromPort?: number; ToPort?: number; CidrIp: string } {
  // Accept shapes like "443/tcp", "80", "icmp", "all"
  const m = raw.match(/^(\d+)(?:[-:](\d+))?\s*\/?\s*(\w+)?/);
  const cidr = cidrs[0] || "0.0.0.0/0";
  if (!m) return { IpProtocol: "-1", CidrIp: cidr };
  const from = parseInt(m[1], 10);
  const to = m[2] ? parseInt(m[2], 10) : from;
  const proto = (m[3] || "tcp").toLowerCase();
  return { IpProtocol: proto, FromPort: from, ToPort: to, CidrIp: cidr };
}
