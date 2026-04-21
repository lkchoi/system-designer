import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { getResourceMapping, getDefaultMapping } from "./iac-mapping";

function exportToPulumi(design: DesignJSON): string {
  const imports = new Set<string>();
  const resources: string[] = [];

  imports.add('import * as pulumi from "@pulumi/pulumi";');
  imports.add('import * as aws from "@pulumi/aws";');

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    const tech = data.plan?.technology ?? "";
    const mapping = getResourceMapping(data.componentType, tech) ?? getDefaultMapping(data.componentType);
    if (!mapping?.pulumi) continue;

    const varName = data.label.replace(/[^a-zA-Z0-9]/g, "_").replace(/^[0-9]/, "_$&") || "resource";
    const { resource: resourcePath } = mapping.pulumi;

    resources.push(buildPulumiResource(varName, resourcePath, data));
  }

  const sortedImports = [...imports].sort();

  return `${sortedImports.join("\n")}

${resources.join("\n\n")}
`;
}

function buildPulumiResource(varName: string, resourcePath: string, data: SystemNodeData): string {
  const lines: string[] = [];
  lines.push(`const ${varName} = new aws.${resourcePath}("${data.label}", {`);

  if (resourcePath === "rds.Instance") {
    lines.push(`  engine: "${data.plan?.technology === "mysql" ? "mysql" : "postgres"}",`);
    lines.push(`  engineVersion: "${data.plan?.technology === "mysql" ? "8.0" : "16"}",`);
    lines.push(`  instanceClass: "db.t3.medium", // TODO: configure`);
    lines.push(`  allocatedStorage: 20,`);
    lines.push(`  username: "admin",`);
    lines.push(`  password: "TODO-use-secrets-manager",`);
    lines.push(`  skipFinalSnapshot: true,`);
  } else if (resourcePath === "dynamodb.Table") {
    lines.push(`  hashKey: "${data.shardKey || "id"}",`);
    lines.push(`  billingMode: "PAY_PER_REQUEST",`);
    lines.push(`  attributes: [{ name: "${data.shardKey || "id"}", type: "S" }],`);
  } else if (resourcePath === "s3.Bucket") {
    lines.push(`  bucketPrefix: "${data.label.toLowerCase().replace(/[^a-z0-9-]/g, "-")}",`);
  } else if (resourcePath === "lambda.Function") {
    lines.push(`  runtime: "nodejs20.x",`);
    lines.push(`  handler: "index.handler",`);
    lines.push(`  code: new pulumi.asset.AssetArchive({}), // TODO: add code`);
    lines.push(`  memorySize: 256,`);
    lines.push(`  timeout: 30,`);
    lines.push(`  role: "TODO-lambda-role-arn",`);
  } else if (resourcePath === "sqs.Queue") {
    lines.push(`  visibilityTimeoutSeconds: 30,`);
  } else if (resourcePath === "elasticache.Cluster") {
    lines.push(`  engine: "redis",`);
    lines.push(`  nodeType: "cache.t3.micro",`);
    lines.push(`  numCacheNodes: 1,`);
  } else {
    lines.push(`  // TODO: configure properties`);
  }

  lines.push(`});`);
  return lines.join("\n");
}

export const pulumiConverter: ConverterModule = {
  id: "pulumi",
  label: "Pulumi",
  description: "TypeScript IaC program",
  category: "iac",
  fileExtensions: [".ts"],
  canImport: false,

  exportDesign(design: DesignJSON) {
    return {
      content: exportToPulumi(design),
      filename: `${design.name}-index.ts`,
      mimeType: "text/typescript",
    };
  },
};
