/**
 * Deterministic storage (S3-style) config generator.
 *
 * Emits a CloudFormation AWS::S3::Bucket with the requested replication,
 * encryption, and lifecycle settings. For non-AWS storage (GCS / Azure
 * Blob) the same fields are encoded as a portable JSON descriptor.
 */

import type { Generator, GeneratorContext, GeneratedFile } from "../types";

export const storageConfigGenerator: Generator = {
  kind: "deterministic",
  supports: (ctx) => ctx.node.componentType === "storage",
  async generate(ctx): Promise<GeneratedFile[]> {
    const p = ctx.node.plan ?? {};
    const tech = (p.technology || "s3").toLowerCase();
    const name = (p.bucketName || ctx.node.label || "bucket")
      .replace(/^s3:\/\//, "")
      .replace(/[^a-z0-9.-]+/gi, "-")
      .toLowerCase();

    const encryption = parseEncryption(p.encryption);
    const lifecycleDays = parseLifecycleDays(p.lifecycle);
    const replication = (p.replication || "").toLowerCase();

    if (tech.startsWith("s3") || tech.startsWith("aws")) {
      const props: Record<string, unknown> = {
        BucketName: name,
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: encryption === "kms" ? "aws:kms" : "AES256",
              },
            },
          ],
        },
        VersioningConfiguration: { Status: "Enabled" },
      };
      if (lifecycleDays > 0) {
        props.LifecycleConfiguration = {
          Rules: [
            {
              Id: "archive-old-objects",
              Status: "Enabled",
              Transitions: [
                { TransitionInDays: lifecycleDays, StorageClass: "GLACIER" },
              ],
            },
          ],
        };
      }
      if (replication.includes("cross-region")) {
        // Replication needs a separate destination bucket; flag as TODO.
        props["x-todo-replication"] =
          "cross-region replication declared in plan; populate ReplicationConfiguration with a destination bucket ARN";
      }
      const cfn = {
        AWSTemplateFormatVersion: "2010-09-09",
        Resources: { Bucket: { Type: "AWS::S3::Bucket", Properties: props } },
      };
      return [{ path: "bucket.cfn.json", contents: JSON.stringify(cfn, null, 2) + "\n" }];
    }

    // Portable descriptor for non-AWS storage.
    return [
      {
        path: "storage.json",
        contents:
          JSON.stringify(
            {
              technology: p.technology || "unspecified",
              bucket: name,
              encryption: encryption === "kms" ? "kms" : "aes256",
              versioning: true,
              lifecycle: lifecycleDays > 0 ? { archiveAfterDays: lifecycleDays } : undefined,
              replication: replication || undefined,
            },
            null,
            2,
          ) + "\n",
      },
    ];
  },
};

function parseEncryption(s: string | undefined): "aes256" | "kms" {
  if (!s) return "aes256";
  if (/kms/i.test(s)) return "kms";
  return "aes256";
}

function parseLifecycleDays(s: string | undefined): number {
  if (!s) return 0;
  const m = s.match(/(\d+)\s*d/i);
  return m ? parseInt(m[1], 10) : 0;
}
