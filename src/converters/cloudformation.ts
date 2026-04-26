import yaml from "js-yaml";
import type { Node } from "@xyflow/react";
import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData, ComponentType } from "../types";
import {
  getResourceMapping,
  getDefaultMapping,
  cfnToComponentType,
  resolveTechId,
} from "./iac-mapping";

function sanitizeLogicalId(label: string): string {
  return label.replace(/[^a-zA-Z0-9]/g, "").replace(/^[0-9]/, "R$&") || "Resource";
}

function exportToCfn(design: DesignJSON): string {
  const resources: Record<string, unknown> = {};
  const usedIds = new Set<string>();
  const resourceDescriptions = new Map<string, string>();

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    const tech = data.plan?.technology ?? "";
    const mapping =
      getResourceMapping(data.componentType, tech) ?? getDefaultMapping(data.componentType);
    if (!mapping?.cfn) continue;

    let logicalId = sanitizeLogicalId(data.label);
    while (usedIds.has(logicalId)) logicalId += "2";
    usedIds.add(logicalId);

    const desc = (data as Record<string, unknown>).description as string | undefined;
    if (desc) resourceDescriptions.set(logicalId, desc);

    resources[logicalId] = {
      Type: mapping.cfn,
      Properties: buildCfnProperties(data, mapping.cfn),
      Metadata: {
        "system-designer:nodeId": node.id,
        "system-designer:componentType": data.componentType,
      },
    };
  }

  const template = {
    AWSTemplateFormatVersion: "2010-09-09",
    Description: `Generated from system design: ${design.name}`,
    Resources: resources,
  };

  let out = yaml.dump(template, { lineWidth: 120, noRefs: true });

  // Inject description comments above each resource
  for (const [logicalId, desc] of resourceDescriptions) {
    const marker = `  ${logicalId}:\n`;
    const idx = out.indexOf(marker);
    if (idx === -1) continue;
    out = out.slice(0, idx) + `  # ${desc}\n` + out.slice(idx);
  }

  return out;
}

function buildCfnProperties(data: SystemNodeData, cfnType: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  if (cfnType === "AWS::RDS::DBInstance") {
    const dbTech = resolveTechId(data.componentType, data.plan?.technology ?? "");
    props.Engine = dbTech === "mysql" || dbTech === "mariadb" ? "mysql" : "postgres";
    props.DBInstanceClass = "db.t3.medium"; // TODO: configure instance size
    props.AllocatedStorage = 20;
    props.MasterUsername = "admin"; // TODO: use Secrets Manager
    props.MasterUserPassword = "TODO-use-secrets-manager";
  } else if (cfnType === "AWS::DynamoDB::Table") {
    props.TableName = data.label.replace(/[^a-zA-Z0-9_.-]/g, "_");
    props.BillingMode = "PAY_PER_REQUEST";
    const attrDefs = [{ AttributeName: "id", AttributeType: "S" }];
    const keySchema = [{ AttributeName: "id", KeyType: "HASH" }];
    if (data.sharded && data.shardKey) {
      attrDefs.push({ AttributeName: data.shardKey, AttributeType: "S" });
      keySchema.push({ AttributeName: data.shardKey, KeyType: "RANGE" });
    }
    props.AttributeDefinitions = attrDefs;
    props.KeySchema = keySchema;
  } else if (cfnType === "AWS::S3::Bucket") {
    props.BucketName = `\${AWS::StackName}-${data.label.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
  } else if (cfnType === "AWS::Lambda::Function") {
    props.Runtime = "nodejs20.x";
    props.Handler = "index.handler";
    props.MemorySize = 256;
    props.Timeout = 30;
    props.Code = { ZipFile: "// TODO: add function code" };
  } else if (cfnType === "AWS::SQS::Queue") {
    props.QueueName = data.label.replace(/[^a-zA-Z0-9_-]/g, "-");
    props.VisibilityTimeout = 30;
  } else if (cfnType === "AWS::ElastiCache::CacheCluster") {
    props.Engine = "redis";
    props.CacheNodeType = "cache.t3.micro";
    props.NumCacheNodes = 1;
  } else if (cfnType === "AWS::ApiGateway::RestApi") {
    props.Name = data.label;
    props.Description = `API Gateway for ${data.label}`;
  } else if (cfnType === "AWS::ElasticLoadBalancingV2::LoadBalancer") {
    props.Type = "application";
    props.Scheme = "internet-facing";
  } else if (cfnType === "AWS::CloudFront::Distribution") {
    props.DistributionConfig = {
      Enabled: true,
      Comment: data.label,
      DefaultCacheBehavior: {
        ViewerProtocolPolicy: "redirect-to-https",
        TargetOriginId: "default",
        ForwardedValues: { QueryString: false },
      },
    };
  } else if (cfnType === "AWS::MSK::Cluster") {
    props.ClusterName = data.label.replace(/[^a-zA-Z0-9-]/g, "-");
    props.NumberOfBrokerNodes = 3;
    props.KafkaVersion = "3.5.1";
  } else if (cfnType === "AWS::EKS::Cluster" || cfnType === "AWS::ECS::Cluster") {
    props.ClusterName = data.label.replace(/[^a-zA-Z0-9-]/g, "-");
  } else if (cfnType === "AWS::Route53::HostedZone") {
    props.Name = "example.com"; // TODO: configure domain
  } else if (cfnType === "AWS::Events::Rule") {
    props.ScheduleExpression = "rate(1 hour)"; // TODO: configure schedule
    props.State = "ENABLED";
  } else if (cfnType === "AWS::SNS::Topic") {
    props.TopicName = data.label.replace(/[^a-zA-Z0-9_-]/g, "-");
  } else if (cfnType === "AWS::Kinesis::Stream") {
    props.ShardCount = 1;
  }

  return props;
}

function importFromCfn(content: string): DesignJSON {
  const parsed = yaml.load(content) as Record<string, unknown>;
  const resources = (parsed?.Resources ?? parsed?.resources ?? {}) as Record<
    string,
    { Type?: string; Properties?: Record<string, unknown>; Metadata?: Record<string, unknown> }
  >;

  const nodes: Node[] = [];
  let x = 100;
  let y = 100;

  for (const [logicalId, resource] of Object.entries(resources)) {
    const cfnType = resource.Type ?? "";
    const match = cfnToComponentType(cfnType);
    if (!match) continue;

    const node: Node = {
      id: (resource.Metadata?.["system-designer:nodeId"] as string) ?? logicalId,
      type: "system",
      position: { x, y },
      data: {
        label: logicalId,
        componentType: match.componentType as ComponentType,
        plan: { technology: match.technologyId },
        sharded: false,
        shardKey: "",
        endpoints: [],
        stressFailure: "none",
        capacityPercent: 100,
        consumerRate: 1000,
      },
    };

    nodes.push(node);
    x += 250;
    if (x > 1000) {
      x = 100;
      y += 200;
    }
  }

  return {
    version: 1,
    name: "Imported from CloudFormation",
    nodes,
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    flowPaths: [],
  };
}

export const cloudformationConverter: ConverterModule = {
  id: "cloudformation",
  label: "CloudFormation",
  description: "AWS infrastructure template (YAML)",
  category: "iac",
  fileExtensions: [".yaml", ".yml", ".json"],
  canImport: true,

  exportDesign(design: DesignJSON) {
    return {
      content: exportToCfn(design),
      filename: `${design.name}-template.yaml`,
      mimeType: "text/yaml",
    };
  },

  importDesign(content: string) {
    return importFromCfn(content);
  },
};
