import { describe, it, expect } from "vitest";
import { pulumiConverter } from "./pulumi";
import type { DesignJSON } from "../db/io";
import type { ExportResult } from "./types";

const SAMPLE_DESIGN: DesignJSON = {
  version: 1,
  name: "OrdersPlatform",
  nodes: [
    {
      id: "db",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "OrdersDB",
        description: "Primary store",
        componentType: "database",
        plan: { technology: "PostgreSQL" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "dynamo",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "SessionTable",
        componentType: "database",
        plan: { technology: "DynamoDB" },
        shardKey: "userId",
        endpoints: [],
        links: [],
      },
    },
    {
      id: "bucket",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "Uploads",
        componentType: "storage",
        plan: { technology: "Amazon S3" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "fn",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "ImageResizer",
        componentType: "serverless",
        plan: { technology: "AWS Lambda" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "cache",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "Sessions",
        componentType: "cache",
        plan: { technology: "Redis" },
        endpoints: [],
        links: [],
      },
    },
  ] as unknown as DesignJSON["nodes"],
  edges: [] as unknown as DesignJSON["edges"],
  viewport: { x: 0, y: 0, zoom: 1 },
  flowPaths: [],
};

describe("pulumi converter", () => {
  it("returns a .ts filename", () => {
    const result = pulumiConverter.exportDesign(SAMPLE_DESIGN) as ExportResult;
    expect(result.filename).toBe("OrdersPlatform-index.ts");
    expect(result.mimeType).toBe("text/typescript");
  });

  it("does not support import", () => {
    expect(pulumiConverter.canImport).toBe(false);
  });

  it("imports pulumi and aws packages", () => {
    const ts = (pulumiConverter.exportDesign(SAMPLE_DESIGN) as ExportResult).content as string;
    expect(ts).toContain('import * as aws from "@pulumi/aws"');
    expect(ts).toContain('import * as pulumi from "@pulumi/pulumi"');
  });

  it("generates an rds.Instance for PostgreSQL", () => {
    const ts = (pulumiConverter.exportDesign(SAMPLE_DESIGN) as ExportResult).content as string;
    expect(ts).toContain('new aws.rds.Instance("OrdersDB"');
    expect(ts).toContain('engine: "postgres"');
    expect(ts).toContain('engineVersion: "16"');
  });

  it("generates a dynamodb.Table with custom hash key", () => {
    const ts = (pulumiConverter.exportDesign(SAMPLE_DESIGN) as ExportResult).content as string;
    expect(ts).toContain('new aws.dynamodb.Table("SessionTable"');
    expect(ts).toContain('hashKey: "userId"');
  });

  it("generates an s3.Bucket", () => {
    const ts = (pulumiConverter.exportDesign(SAMPLE_DESIGN) as ExportResult).content as string;
    expect(ts).toContain('new aws.s3.Bucket("Uploads"');
    expect(ts).toContain('bucketPrefix: "uploads"');
  });

  it("generates a lambda.Function", () => {
    const ts = (pulumiConverter.exportDesign(SAMPLE_DESIGN) as ExportResult).content as string;
    expect(ts).toContain('new aws.lambda.Function("ImageResizer"');
    expect(ts).toContain('runtime: "nodejs20.x"');
    expect(ts).toContain("memorySize: 256");
  });

  it("generates an elasticache.Cluster for Redis", () => {
    const ts = (pulumiConverter.exportDesign(SAMPLE_DESIGN) as ExportResult).content as string;
    expect(ts).toContain('new aws.elasticache.Cluster("Sessions"');
    expect(ts).toContain('engine: "redis"');
  });

  it("adds description as a comment", () => {
    const ts = (pulumiConverter.exportDesign(SAMPLE_DESIGN) as ExportResult).content as string;
    expect(ts).toContain("// Primary store");
  });

  it("handles an empty design", () => {
    const empty: DesignJSON = {
      version: 1,
      name: "Empty",
      nodes: [] as unknown as DesignJSON["nodes"],
      edges: [] as unknown as DesignJSON["edges"],
      viewport: { x: 0, y: 0, zoom: 1 },
      flowPaths: [],
    };
    const ts = (pulumiConverter.exportDesign(empty) as ExportResult).content as string;
    expect(ts).toContain("@pulumi/pulumi");
    expect(ts).not.toContain("new aws.");
  });
});
