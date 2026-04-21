import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { getResourceMapping, getDefaultMapping } from "./iac-mapping";

function exportToCdk(design: DesignJSON): string {
  const imports = new Set<string>();
  const constructs: string[] = [];
  const sanitized = design.name.replace(/[^a-zA-Z0-9]/g, "");
  const stackName = (sanitized.charAt(0).toUpperCase() + sanitized.slice(1)) || "App";

  imports.add("import * as cdk from 'aws-cdk-lib';");
  imports.add("import { Construct } from 'constructs';");

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    const tech = data.plan?.technology ?? "";
    const mapping = getResourceMapping(data.componentType, tech) ?? getDefaultMapping(data.componentType);
    if (!mapping?.cdk) continue;

    const { module: mod, construct: cls } = mapping.cdk;
    const alias = mod.split("/").pop()!.replace(/-/g, "_");
    imports.add(`import * as ${alias} from '${mod}';`);

    const varName = data.label.replace(/[^a-zA-Z0-9]/g, "_").replace(/^[0-9]/, "_$&") || "resource";

    constructs.push(buildCdkConstruct(varName, alias, cls, data));
  }

  const sortedImports = [...imports].sort();

  return `${sortedImports.join("\n")}

export class ${stackName}Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

${constructs.map((c) => c.split("\n").map((l) => `    ${l}`).join("\n")).join("\n\n")}
  }
}
`;
}

function buildCdkConstruct(varName: string, alias: string, cls: string, data: SystemNodeData): string {
  const lines: string[] = [];
  lines.push(`const ${varName} = new ${alias}.${cls}(this, '${data.label}', {`);

  if (cls === "DatabaseInstance") {
    const engine = data.plan?.technology === "mysql" ? "rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 })" : "rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 })";
    lines.push(`  engine: ${engine.replace(/rds\./g, `${alias}.`)},`);
    lines.push(`  instanceType: cdk.aws_ec2.InstanceType.of(cdk.aws_ec2.InstanceClass.T3, cdk.aws_ec2.InstanceSize.MEDIUM),`);
  } else if (cls === "Table") {
    lines.push(`  partitionKey: { name: '${data.shardKey || "id"}', type: ${alias}.AttributeType.STRING },`);
    lines.push(`  billingMode: ${alias}.BillingMode.PAY_PER_REQUEST,`);
    lines.push(`  removalPolicy: cdk.RemovalPolicy.DESTROY,`);
  } else if (cls === "Bucket") {
    lines.push(`  removalPolicy: cdk.RemovalPolicy.DESTROY,`);
    lines.push(`  autoDeleteObjects: true,`);
  } else if (cls === "Function") {
    lines.push(`  runtime: ${alias}.Runtime.NODEJS_20_X,`);
    lines.push(`  handler: 'index.handler',`);
    lines.push(`  code: ${alias}.Code.fromInline('// TODO: add function code'),`);
    lines.push(`  memorySize: 256,`);
    lines.push(`  timeout: cdk.Duration.seconds(30),`);
  } else if (cls === "Queue") {
    lines.push(`  visibilityTimeout: cdk.Duration.seconds(30),`);
  } else if (cls === "RestApi") {
    lines.push(`  description: 'API Gateway for ${data.label}',`);
  } else if (cls === "Distribution") {
    lines.push(`  comment: '${data.label}',`);
    lines.push(`  // TODO: configure origins and behaviors`);
  } else {
    lines.push(`  // TODO: configure properties`);
  }

  lines.push(`});`);
  return lines.join("\n");
}

export const awsCdkConverter: ConverterModule = {
  id: "aws-cdk",
  label: "AWS CDK",
  description: "TypeScript CDK stack",
  category: "iac",
  fileExtensions: [".ts"],
  canImport: false,

  exportDesign(design: DesignJSON) {
    return {
      content: exportToCdk(design),
      filename: `${design.name}-stack.ts`,
      mimeType: "text/typescript",
    };
  },
};
