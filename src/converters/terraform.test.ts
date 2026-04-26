import { describe, it, expect } from "vitest";
import { terraformConverter } from "./terraform";
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

describe("terraform converter — export", () => {
  function parse(design: DesignJSON): Record<string, unknown> {
    const json = (terraformConverter.exportDesign(design) as ExportResult).content as string;
    return JSON.parse(json);
  }

  it("returns a .tf.json filename", () => {
    const result = terraformConverter.exportDesign(SAMPLE_DESIGN) as ExportResult;
    expect(result.filename).toBe("OrdersPlatform.tf.json");
    expect(result.mimeType).toBe("application/json");
  });

  it("includes terraform and provider blocks", () => {
    const tf = parse(SAMPLE_DESIGN);
    expect(tf.terraform).toBeDefined();
    expect(tf.provider).toBeDefined();
    const provider = tf.provider as { aws: { region: string } };
    expect(provider.aws.region).toBe("us-east-1");
  });

  it("generates aws_db_instance with postgres engine", () => {
    const tf = parse(SAMPLE_DESIGN);
    const resources = tf.resource as Record<string, Record<string, Record<string, unknown>>>;
    const rds = resources["aws_db_instance"];
    expect(rds).toBeDefined();
    expect(rds["ordersdb"]).toBeDefined();
    expect(rds["ordersdb"].engine).toBe("postgres");
    expect(rds["ordersdb"].engine_version).toBe("16");
  });

  it("generates aws_dynamodb_table with custom hash key", () => {
    const tf = parse(SAMPLE_DESIGN);
    const resources = tf.resource as Record<string, Record<string, Record<string, unknown>>>;
    const ddb = resources["aws_dynamodb_table"];
    expect(ddb).toBeDefined();
    expect(ddb["sessiontable"].hash_key).toBe("userId");
    expect(ddb["sessiontable"].billing_mode).toBe("PAY_PER_REQUEST");
  });

  it("generates aws_s3_bucket", () => {
    const tf = parse(SAMPLE_DESIGN);
    const resources = tf.resource as Record<string, Record<string, Record<string, unknown>>>;
    expect(resources["aws_s3_bucket"]).toBeDefined();
    expect(resources["aws_s3_bucket"]["uploads"].bucket_prefix).toBe("uploads");
  });

  it("generates aws_lambda_function", () => {
    const tf = parse(SAMPLE_DESIGN);
    const resources = tf.resource as Record<string, Record<string, Record<string, unknown>>>;
    const lambda = resources["aws_lambda_function"];
    expect(lambda).toBeDefined();
    expect(lambda["imageresizer"].runtime).toBe("nodejs20.x");
    expect(lambda["imageresizer"].memory_size).toBe(256);
  });

  it("generates aws_elasticache_cluster for Redis", () => {
    const tf = parse(SAMPLE_DESIGN);
    const resources = tf.resource as Record<string, Record<string, Record<string, unknown>>>;
    expect(resources["aws_elasticache_cluster"]).toBeDefined();
    const redis = resources["aws_elasticache_cluster"]["sessions"];
    expect(redis.engine).toBe("redis");
  });

  it("generates aws_sqs_queue", () => {
    const tf = parse(SAMPLE_DESIGN);
    const resources = tf.resource as Record<string, Record<string, Record<string, unknown>>>;
    expect(resources["aws_sqs_queue"]).toBeDefined();
  });

  it("embeds arkon metadata in // key", () => {
    const tf = parse(SAMPLE_DESIGN);
    const resources = tf.resource as Record<string, Record<string, Record<string, unknown>>>;
    const meta = resources["aws_db_instance"]["ordersdb"]["//"] as Record<string, string>;
    expect(meta["arkon:nodeId"]).toBe("db");
    expect(meta["arkon:componentType"]).toBe("database");
    expect(meta.description).toBe("Primary store");
  });

  it("uses underscore naming convention", () => {
    const design: DesignJSON = {
      version: 1,
      name: "X",
      nodes: [
        {
          id: "a",
          type: "system",
          position: { x: 0, y: 0 },
          data: {
            label: "My Cool Service",
            componentType: "database",
            plan: { technology: "PostgreSQL" },
            endpoints: [],
            links: [],
          },
        },
      ] as unknown as DesignJSON["nodes"],
      edges: [] as unknown as DesignJSON["edges"],
      viewport: { x: 0, y: 0, zoom: 1 },
      flowPaths: [],
    };
    const tf = parse(design);
    const resources = tf.resource as Record<string, Record<string, unknown>>;
    expect(resources["aws_db_instance"]["my_cool_service"]).toBeDefined();
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
    const tf = parse(empty);
    expect(tf.resource).toEqual({});
  });
});

describe("terraform converter — import", () => {
  it("round-trips a design through export then import", () => {
    const exported = (terraformConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    const imported = terraformConverter.importDesign!(exported);
    expect(imported.name).toBe("Imported from Terraform");
    expect(imported.nodes.length).toBeGreaterThan(0);
  });

  it("maps terraform resource type back to correct componentType", () => {
    const exported = (terraformConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    const imported = terraformConverter.importDesign!(exported);
    const dbNode = imported.nodes.find((n) => n.id === "ordersdb");
    expect(dbNode).toBeDefined();
    expect((dbNode!.data as { componentType: string }).componentType).toBe("database");
  });

  it("converts underscores to hyphens in imported labels", () => {
    const exported = (terraformConverter.exportDesign(SAMPLE_DESIGN) as ExportResult)
      .content as string;
    const imported = terraformConverter.importDesign!(exported);
    const node = imported.nodes.find((n) => n.id === "ordersdb");
    expect((node!.data as { label: string }).label).toBe("ordersdb");
  });
});
