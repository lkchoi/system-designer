import { describe, it, expect } from "vitest";
import { awsCdkConverter } from "./aws-cdk";
import type { DesignJSON } from "../db/io";

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
  ] as unknown as DesignJSON["nodes"],
  edges: [] as unknown as DesignJSON["edges"],
  viewport: { x: 0, y: 0, zoom: 1 },
  flowPaths: [],
};

describe("aws-cdk converter", () => {
  it("returns a .ts filename", () => {
    const result = awsCdkConverter.exportDesign(SAMPLE_DESIGN);
    expect(result.filename).toBe("OrdersPlatform-stack.ts");
    expect(result.mimeType).toBe("text/typescript");
  });

  it("does not support import", () => {
    expect(awsCdkConverter.canImport).toBe(false);
  });

  it("generates a Stack class named from the design", () => {
    const ts = awsCdkConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(ts).toContain("export class OrdersPlatformStack extends cdk.Stack");
  });

  it("imports cdk and constructs", () => {
    const ts = awsCdkConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(ts).toContain("import * as cdk from 'aws-cdk-lib'");
    expect(ts).toContain("import { Construct } from 'constructs'");
  });

  it("imports module-specific packages", () => {
    const ts = awsCdkConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(ts).toContain("import * as aws_rds from 'aws-cdk-lib/aws-rds'");
    expect(ts).toContain("import * as aws_dynamodb from 'aws-cdk-lib/aws-dynamodb'");
    expect(ts).toContain("import * as aws_s3 from 'aws-cdk-lib/aws-s3'");
    expect(ts).toContain("import * as aws_lambda from 'aws-cdk-lib/aws-lambda'");
    expect(ts).toContain("import * as aws_sqs from 'aws-cdk-lib/aws-sqs'");
  });

  it("generates a DatabaseInstance for PostgreSQL", () => {
    const ts = awsCdkConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(ts).toContain("new aws_rds.DatabaseInstance(this, 'OrdersDB'");
    expect(ts).toContain("PostgresEngineVersion");
  });

  it("generates a Table for DynamoDB with custom partition key", () => {
    const ts = awsCdkConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(ts).toContain("new aws_dynamodb.Table(this, 'SessionTable'");
    expect(ts).toContain("partitionKey: { name: 'userId'");
    expect(ts).toContain("BillingMode.PAY_PER_REQUEST");
  });

  it("generates a Bucket for S3", () => {
    const ts = awsCdkConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(ts).toContain("new aws_s3.Bucket(this, 'Uploads'");
    expect(ts).toContain("autoDeleteObjects: true");
  });

  it("generates a Function for Lambda", () => {
    const ts = awsCdkConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(ts).toContain("new aws_lambda.Function(this, 'ImageResizer'");
    expect(ts).toContain("Runtime.NODEJS_20_X");
    expect(ts).toContain("memorySize: 256");
  });

  it("generates a Queue for SQS", () => {
    const ts = awsCdkConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(ts).toContain("new aws_sqs.Queue(this, 'TaskQueue'");
    expect(ts).toContain("visibilityTimeout");
  });

  it("adds description as a comment above the construct", () => {
    const ts = awsCdkConverter.exportDesign(SAMPLE_DESIGN).content as string;
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
    const ts = awsCdkConverter.exportDesign(empty).content as string;
    expect(ts).toContain("export class EmptyStack extends cdk.Stack");
    // No construct lines
    expect(ts).not.toContain("new aws_rds");
  });
});
