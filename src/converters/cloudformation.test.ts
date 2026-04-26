import { describe, it, expect } from "vitest";
import { cloudformationConverter } from "./cloudformation";
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
        description: "Primary OLTP store",
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
        sharded: true,
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
      id: "queue",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "TaskQueue",
        componentType: "message-queue",
        plan: { technology: "SQS" },
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
    {
      id: "gw",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "Public API",
        componentType: "api-gateway",
        plan: { technology: "AWS API Gateway" },
        endpoints: [],
        links: [],
      },
    },
  ] as unknown as DesignJSON["nodes"],
  edges: [] as unknown as DesignJSON["edges"],
  viewport: { x: 0, y: 0, zoom: 1 },
  flowPaths: [],
};

describe("cloudformation converter — export", () => {
  it("returns a YAML filename with text/yaml mimeType", () => {
    const result = cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult;
    expect(result.filename).toBe("OrdersPlatform-template.yaml");
    expect(result.mimeType).toBe("text/yaml");
  });

  it("includes AWSTemplateFormatVersion and Description", () => {
    const yaml = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("AWSTemplateFormatVersion: '2010-09-09'");
    expect(yaml).toContain("Generated from system design: OrdersPlatform");
  });

  it("generates AWS::RDS::DBInstance for a PostgreSQL database", () => {
    const yaml = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("Type: AWS::RDS::DBInstance");
    expect(yaml).toContain("Engine: postgres");
    expect(yaml).toContain("DBInstanceClass: db.t3.medium");
  });

  it("generates AWS::DynamoDB::Table with shard key as range key", () => {
    const yaml = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("Type: AWS::DynamoDB::Table");
    expect(yaml).toContain("BillingMode: PAY_PER_REQUEST");
    expect(yaml).toContain("AttributeName: userId");
    expect(yaml).toContain("KeyType: RANGE");
  });

  it("generates AWS::S3::Bucket", () => {
    const yaml = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("Type: AWS::S3::Bucket");
  });

  it("generates AWS::Lambda::Function", () => {
    const yaml = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("Type: AWS::Lambda::Function");
    expect(yaml).toContain("Runtime: nodejs20.x");
    expect(yaml).toContain("MemorySize: 256");
  });

  it("generates AWS::SQS::Queue", () => {
    const yaml = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("Type: AWS::SQS::Queue");
    expect(yaml).toContain("VisibilityTimeout: 30");
  });

  it("generates AWS::ElastiCache::CacheCluster for Redis", () => {
    const yaml = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("Type: AWS::ElastiCache::CacheCluster");
    expect(yaml).toContain("Engine: redis");
  });

  it("generates AWS::ApiGateway::RestApi", () => {
    const yaml = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("Type: AWS::ApiGateway::RestApi");
  });

  it("injects description as a comment above the resource", () => {
    const yaml = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("# Primary OLTP store");
  });

  it("stores arkon metadata on resources", () => {
    const yaml = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    expect(yaml).toContain("arkon:nodeId: db");
    expect(yaml).toContain("arkon:componentType: database");
  });

  it("generates MySQL engine for a MySQL database", () => {
    const design: DesignJSON = {
      version: 1,
      name: "X",
      nodes: [
        {
          id: "db",
          type: "system",
          position: { x: 0, y: 0 },
          data: {
            label: "DB",
            componentType: "database",
            plan: { technology: "MySQL" },
            endpoints: [],
            links: [],
          },
        },
      ] as unknown as DesignJSON["nodes"],
      edges: [] as unknown as DesignJSON["edges"],
      viewport: { x: 0, y: 0, zoom: 1 },
      flowPaths: [],
    };
    const yaml = (cloudformationConverter.exportDesign(design) as ExportResult).content as string;
    expect(yaml).toContain("Engine: mysql");
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
    const yaml = (cloudformationConverter.exportDesign(empty) as ExportResult).content as string;
    expect(yaml).toContain("AWSTemplateFormatVersion");
    expect(yaml).toContain("Resources: {}");
  });
});

describe("cloudformation converter — import", () => {
  it("round-trips a design through export then import", () => {
    const exported = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    const imported = cloudformationConverter.importDesign!(exported);
    expect(imported.name).toBe("Imported from CloudFormation");
    expect(imported.nodes.length).toBeGreaterThan(0);
  });

  it("recovers node IDs from metadata", () => {
    const exported = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    const imported = cloudformationConverter.importDesign!(exported);
    const nodeIds = imported.nodes.map((n) => n.id);
    expect(nodeIds).toContain("db");
    expect(nodeIds).toContain("fn");
  });

  it("maps CFN resource type back to correct componentType", () => {
    const exported = (cloudformationConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    const imported = cloudformationConverter.importDesign!(exported);
    const s3Node = imported.nodes.find((n) => n.id === "bucket");
    expect(s3Node).toBeDefined();
    expect((s3Node!.data as { componentType: string }).componentType).toBe("storage");
  });
});
