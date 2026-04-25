import { describe, it, expect } from "vitest";
import { localstackConverter } from "./localstack";
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
        componentType: "database",
        plan: { technology: "PostgreSQL" },
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
  ] as unknown as DesignJSON["nodes"],
  edges: [] as unknown as DesignJSON["edges"],
  viewport: { x: 0, y: 0, zoom: 1 },
  flowPaths: [],
};

describe("localstack converter", () => {
  it("returns a .yaml filename", () => {
    const result = localstackConverter.exportDesign(SAMPLE_DESIGN);
    expect(result.filename).toBe("OrdersPlatform-localstack.yaml");
    expect(result.mimeType).toBe("text/yaml");
  });

  it("does not support import", () => {
    expect(localstackConverter.canImport).toBe(false);
  });

  it("includes a LocalStack docker-compose service", () => {
    const content = localstackConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(content).toContain("localstack/localstack:latest");
    expect(content).toContain("4566:4566");
  });

  it("includes an init deploy script that creates a CFN stack", () => {
    const content = localstackConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(content).toContain("awslocal cloudformation create-stack");
    expect(content).toContain("--stack-name OrdersPlatform");
  });

  it("includes the embedded CloudFormation template", () => {
    const content = localstackConverter.exportDesign(SAMPLE_DESIGN).content as string;
    // The CFN template should contain resources from the design
    expect(content).toContain("AWS::Lambda::Function");
    expect(content).toContain("AWS::S3::Bucket");
  });

  it("includes file markers for the three output sections", () => {
    const content = localstackConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(content).toContain("--- docker-compose.yaml ---");
    expect(content).toContain("--- init/template.yaml ---");
    expect(content).toContain("--- init/deploy.sh ---");
  });

  it("lists required AWS services in the environment", () => {
    const content = localstackConverter.exportDesign(SAMPLE_DESIGN).content as string;
    expect(content).toContain("SERVICES:");
    expect(content).toContain("s3");
    expect(content).toContain("lambda");
    expect(content).toContain("dynamodb");
  });
});
