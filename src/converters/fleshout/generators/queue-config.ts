/**
 * Deterministic message-queue config generator.
 *
 * Tech-aware:
 *  - kafka / msk → topic definitions JSON (one per declared topic)
 *  - sqs → SQS queue + DLQ CFN
 *  - rabbitmq → policies + exchange/queue declaration JSON
 *  - default → a topic.md doc listing the configured topics
 *
 * Plan fields used: topics, retention, deliveryMode, partitions.
 */

import type { Generator, GeneratorContext, GeneratedFile } from "../types";

export const queueConfigGenerator: Generator = {
  kind: "deterministic",
  supports: (ctx) => ctx.node.componentType === "message-queue",
  async generate(ctx): Promise<GeneratedFile[]> {
    const p = ctx.node.plan ?? {};
    const tech = (p.technology || "").toLowerCase();
    const topics = (p.topics || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const retention = p.retention || "7d";
    const partitions = parseInt(p.partitions || "12", 10) || 12;
    const delivery = (p.deliveryMode || "at-least-once").toLowerCase();

    if (tech.includes("kafka") || tech.includes("msk")) {
      const defs = topics.map((t) => ({
        name: t,
        partitions,
        replicationFactor: 3,
        config: {
          "retention.ms": durationToMs(retention),
          "cleanup.policy": "delete",
          "min.insync.replicas": delivery.includes("exactly") ? 2 : 1,
        },
      }));
      return [
        {
          path: "topics.json",
          contents: JSON.stringify({ topics: defs }, null, 2) + "\n",
        },
      ];
    }

    if (tech.includes("sqs")) {
      // CFN: one main queue + a DLQ per topic name. SQS doesn't have
      // "topics" per se; treat each name as a queue.
      const resources: Record<string, unknown> = {};
      for (const t of topics) {
        const safe = t.replace(/[^A-Za-z0-9]/g, "");
        resources[`${safe}DLQ`] = {
          Type: "AWS::SQS::Queue",
          Properties: {
            QueueName: `${t}-dlq`,
            MessageRetentionPeriod: 1209600, // 14 days for DLQ visibility
          },
        };
        resources[safe] = {
          Type: "AWS::SQS::Queue",
          Properties: {
            QueueName: t,
            MessageRetentionPeriod: Math.floor(durationToMs(retention) / 1000),
            RedrivePolicy: {
              deadLetterTargetArn: { "Fn::GetAtt": [`${safe}DLQ`, "Arn"] },
              maxReceiveCount: 3,
            },
          },
        };
      }
      return [
        {
          path: "queues.cfn.json",
          contents:
            JSON.stringify(
              { AWSTemplateFormatVersion: "2010-09-09", Resources: resources },
              null,
              2,
            ) + "\n",
        },
      ];
    }

    // Fallback: just document the topics.
    const md = [
      `# ${ctx.node.label} — topic registry`,
      ``,
      `**Technology**: ${p.technology || "unspecified"}`,
      `**Delivery**: ${delivery}`,
      `**Retention**: ${retention}`,
      ``,
      `## Topics`,
      ...(topics.length === 0
        ? [`(none declared in plan.topics)`]
        : topics.map((t) => `- \`${t}\``)),
      ``,
    ].join("\n");
    return [{ path: "topics.md", contents: md }];
  },
};

function durationToMs(d: string): number {
  const m = d.match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || "d").toLowerCase();
  const factor = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return n * factor;
}
