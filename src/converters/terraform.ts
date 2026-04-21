import type { Node } from "@xyflow/react";
import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData, ComponentType } from "../types";
import { getResourceMapping, getDefaultMapping, terraformToComponentType } from "./iac-mapping";

function sanitizeName(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^[0-9]/, "r$&") || "resource";
}

function exportToTerraform(design: DesignJSON): string {
  const resources: Record<string, Record<string, Record<string, unknown>>> = {};
  const usedNames = new Set<string>();

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    const tech = data.plan?.technology ?? "";
    const mapping = getResourceMapping(data.componentType, tech) ?? getDefaultMapping(data.componentType);
    if (!mapping?.terraform) continue;

    let name = sanitizeName(data.label);
    while (usedNames.has(name)) name += "_2";
    usedNames.add(name);

    if (!resources[mapping.terraform]) {
      resources[mapping.terraform] = {};
    }

    resources[mapping.terraform][name] = {
      ...buildTfProperties(data, mapping.terraform),
      "//": {
        "system-designer:nodeId": node.id,
        "system-designer:componentType": data.componentType,
      },
    };
  }

  const tfJson = {
    terraform: {
      required_providers: {
        aws: {
          source: "hashicorp/aws",
          version: "~> 5.0",
        },
      },
    },
    provider: {
      aws: {
        region: "us-east-1", // TODO: configure region
      },
    },
    resource: resources,
  };

  return JSON.stringify(tfJson, null, 2);
}

function buildTfProperties(data: SystemNodeData, tfType: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  if (tfType === "aws_db_instance") {
    props.engine = data.plan?.technology === "mysql" ? "mysql" : "postgres";
    props.engine_version = data.plan?.technology === "mysql" ? "8.0" : "16";
    props.instance_class = "db.t3.medium"; // TODO
    props.allocated_storage = 20;
    props.username = "admin";
    props.password = "TODO-use-secrets-manager";
    props.skip_final_snapshot = true;
  } else if (tfType === "aws_dynamodb_table") {
    props.name = data.label.replace(/[^a-zA-Z0-9_.-]/g, "_");
    props.billing_mode = "PAY_PER_REQUEST";
    props.hash_key = data.shardKey || "id";
    props.attribute = [{ name: data.shardKey || "id", type: "S" }];
  } else if (tfType === "aws_s3_bucket") {
    props.bucket_prefix = data.label.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  } else if (tfType === "aws_lambda_function") {
    props.function_name = data.label.replace(/[^a-zA-Z0-9_-]/g, "_");
    props.runtime = "nodejs20.x";
    props.handler = "index.handler";
    props.memory_size = 256;
    props.timeout = 30;
    props.filename = "lambda.zip"; // TODO: provide deployment package
    props.role = "TODO-lambda-execution-role-arn";
  } else if (tfType === "aws_sqs_queue") {
    props.name = data.label.replace(/[^a-zA-Z0-9_-]/g, "-");
    props.visibility_timeout_seconds = 30;
  } else if (tfType === "aws_elasticache_cluster") {
    props.engine = "redis";
    props.node_type = "cache.t3.micro";
    props.num_cache_nodes = 1;
  } else if (tfType === "aws_api_gateway_rest_api") {
    props.name = data.label;
    props.description = `API Gateway for ${data.label}`;
  } else if (tfType === "aws_lb") {
    props.load_balancer_type = "application";
    props.internal = false;
  } else if (tfType === "aws_cloudfront_distribution") {
    props.enabled = true;
    props.comment = data.label;
  } else if (tfType === "aws_msk_cluster") {
    props.cluster_name = data.label.replace(/[^a-zA-Z0-9-]/g, "-");
    props.number_of_broker_nodes = 3;
    props.kafka_version = "3.5.1";
  } else if (tfType === "aws_eks_cluster" || tfType === "aws_ecs_cluster") {
    props.name = data.label.replace(/[^a-zA-Z0-9-]/g, "-");
  } else if (tfType === "aws_route53_zone") {
    props.name = "example.com"; // TODO: configure domain
  } else if (tfType === "aws_cloudwatch_event_rule") {
    props.schedule_expression = "rate(1 hour)"; // TODO
  } else if (tfType === "aws_sns_topic") {
    props.name = data.label.replace(/[^a-zA-Z0-9_-]/g, "-");
  } else if (tfType === "aws_kinesis_stream") {
    props.shard_count = 1;
  }

  return props;
}

function importFromTerraform(content: string): DesignJSON {
  const parsed = JSON.parse(content);
  const resources = parsed?.resource ?? {};

  const nodes: Node[] = [];
  let x = 100;
  let y = 100;

  for (const [tfType, instances] of Object.entries(resources) as [string, Record<string, Record<string, unknown>>][]) {
    const match = terraformToComponentType(tfType);
    if (!match) continue;

    for (const [name, _props] of Object.entries(instances)) {
      const node: Node = {
        id: name,
        type: "system",
        position: { x, y },
        data: {
          label: name.replace(/_/g, "-"),
          componentType: match.componentType as ComponentType,
          status: "healthy",
          metrics: { cpu: 0, memory: 0, requestsPerSec: 0, latency: 0 },
          plan: { technology: match.technologyId },
          sharded: false,
          shardKey: "",
          endpoints: [],
          capClassification: "",
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
  }

  return {
    version: 1,
    name: "Imported from Terraform",
    nodes,
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    flowPaths: [],
  };
}

export const terraformConverter: ConverterModule = {
  id: "terraform",
  label: "Terraform",
  description: "HashiCorp IaC (.tf.json)",
  category: "iac",
  fileExtensions: [".tf.json", ".json"],
  canImport: true,

  exportDesign(design: DesignJSON) {
    return {
      content: exportToTerraform(design),
      filename: `${design.name}.tf.json`,
      mimeType: "application/json",
    };
  },

  importDesign(content: string) {
    return importFromTerraform(content);
  },
};
