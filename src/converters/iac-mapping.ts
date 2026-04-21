import type { ComponentType } from "../types";

/**
 * Maps (componentType, technologyId) to format-specific resource types.
 * Used by all IaC converters to determine what resource to generate.
 */

export interface ResourceMapping {
  /** AWS CloudFormation resource type */
  cfn?: string;
  /** Terraform resource type */
  terraform?: string;
  /** Kubernetes kind + apiVersion */
  k8s?: { kind: string; apiVersion: string };
  /** Docker image for docker-compose / LocalStack */
  docker?: string;
  /** CDK module and construct */
  cdk?: { module: string; construct: string };
  /** Pulumi module and resource */
  pulumi?: { module: string; resource: string };
}

interface MappingEntry {
  componentType: ComponentType;
  technologyId: string;
  mapping: ResourceMapping;
}

// -- Databases --
const DB_ENTRIES: MappingEntry[] = [
  {
    componentType: "database",
    technologyId: "postgresql",
    mapping: {
      cfn: "AWS::RDS::DBInstance",
      terraform: "aws_db_instance",
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "postgres:16-alpine",
      cdk: { module: "aws-cdk-lib/aws-rds", construct: "DatabaseInstance" },
      pulumi: { module: "@pulumi/aws", resource: "rds.Instance" },
    },
  },
  {
    componentType: "database",
    technologyId: "mysql",
    mapping: {
      cfn: "AWS::RDS::DBInstance",
      terraform: "aws_db_instance",
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "mysql:8",
      cdk: { module: "aws-cdk-lib/aws-rds", construct: "DatabaseInstance" },
      pulumi: { module: "@pulumi/aws", resource: "rds.Instance" },
    },
  },
  {
    componentType: "database",
    technologyId: "mongodb",
    mapping: {
      terraform: "mongodbatlas_cluster",
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "mongo:7",
    },
  },
  {
    componentType: "database",
    technologyId: "dynamodb",
    mapping: {
      cfn: "AWS::DynamoDB::Table",
      terraform: "aws_dynamodb_table",
      docker: "amazon/dynamodb-local:latest",
      cdk: { module: "aws-cdk-lib/aws-dynamodb", construct: "Table" },
      pulumi: { module: "@pulumi/aws", resource: "dynamodb.Table" },
    },
  },
  {
    componentType: "database",
    technologyId: "cassandra",
    mapping: {
      cfn: "AWS::Cassandra::Table",
      terraform: "aws_keyspaces_table",
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "cassandra:4",
    },
  },
  {
    componentType: "database",
    technologyId: "aurora",
    mapping: {
      cfn: "AWS::RDS::DBCluster",
      terraform: "aws_rds_cluster",
      cdk: { module: "aws-cdk-lib/aws-rds", construct: "DatabaseCluster" },
      pulumi: { module: "@pulumi/aws", resource: "rds.Cluster" },
    },
  },
  {
    componentType: "database",
    technologyId: "cockroachdb",
    mapping: {
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "cockroachdb/cockroach:latest",
    },
  },
  {
    componentType: "database",
    technologyId: "sql-server",
    mapping: {
      cfn: "AWS::RDS::DBInstance",
      terraform: "aws_db_instance",
      docker: "mcr.microsoft.com/mssql/server:2022-latest",
    },
  },
];

// -- Cache --
const CACHE_ENTRIES: MappingEntry[] = [
  {
    componentType: "cache",
    technologyId: "redis",
    mapping: {
      cfn: "AWS::ElastiCache::CacheCluster",
      terraform: "aws_elasticache_cluster",
      k8s: { kind: "Deployment", apiVersion: "apps/v1" },
      docker: "redis:7-alpine",
      cdk: { module: "aws-cdk-lib/aws-elasticache", construct: "CfnCacheCluster" },
      pulumi: { module: "@pulumi/aws", resource: "elasticache.Cluster" },
    },
  },
  {
    componentType: "cache",
    technologyId: "memcached",
    mapping: {
      cfn: "AWS::ElastiCache::CacheCluster",
      terraform: "aws_elasticache_cluster",
      k8s: { kind: "Deployment", apiVersion: "apps/v1" },
      docker: "memcached:1-alpine",
    },
  },
];

// -- Message Queue --
const QUEUE_ENTRIES: MappingEntry[] = [
  {
    componentType: "message-queue",
    technologyId: "kafka",
    mapping: {
      cfn: "AWS::MSK::Cluster",
      terraform: "aws_msk_cluster",
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "confluentinc/cp-kafka:7.6.0",
      cdk: { module: "aws-cdk-lib/aws-msk", construct: "CfnCluster" },
      pulumi: { module: "@pulumi/aws", resource: "msk.Cluster" },
    },
  },
  {
    componentType: "message-queue",
    technologyId: "sqs",
    mapping: {
      cfn: "AWS::SQS::Queue",
      terraform: "aws_sqs_queue",
      docker: "softwaremill/elasticmq-native:latest",
      cdk: { module: "aws-cdk-lib/aws-sqs", construct: "Queue" },
      pulumi: { module: "@pulumi/aws", resource: "sqs.Queue" },
    },
  },
  {
    componentType: "message-queue",
    technologyId: "rabbitmq",
    mapping: {
      cfn: "AWS::AmazonMQ::Broker",
      terraform: "aws_mq_broker",
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "rabbitmq:3-management-alpine",
    },
  },
  {
    componentType: "message-queue",
    technologyId: "redis",
    mapping: {
      k8s: { kind: "Deployment", apiVersion: "apps/v1" },
      docker: "redis:7-alpine",
    },
  },
  {
    componentType: "message-queue",
    technologyId: "nats",
    mapping: {
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "nats:2-alpine",
    },
  },
  {
    componentType: "message-queue",
    technologyId: "pubsub",
    mapping: {
      terraform: "google_pubsub_topic",
    },
  },
];

// -- Storage --
const STORAGE_ENTRIES: MappingEntry[] = [
  {
    componentType: "storage",
    technologyId: "s3",
    mapping: {
      cfn: "AWS::S3::Bucket",
      terraform: "aws_s3_bucket",
      docker: "minio/minio:latest",
      cdk: { module: "aws-cdk-lib/aws-s3", construct: "Bucket" },
      pulumi: { module: "@pulumi/aws", resource: "s3.Bucket" },
    },
  },
  {
    componentType: "storage",
    technologyId: "gcs",
    mapping: {
      terraform: "google_storage_bucket",
    },
  },
  {
    componentType: "storage",
    technologyId: "azure-blob",
    mapping: {
      terraform: "azurerm_storage_account",
    },
  },
];

// -- Serverless --
const SERVERLESS_ENTRIES: MappingEntry[] = [
  {
    componentType: "serverless",
    technologyId: "lambda",
    mapping: {
      cfn: "AWS::Lambda::Function",
      terraform: "aws_lambda_function",
      cdk: { module: "aws-cdk-lib/aws-lambda", construct: "Function" },
      pulumi: { module: "@pulumi/aws", resource: "lambda.Function" },
    },
  },
  {
    componentType: "serverless",
    technologyId: "cloud-functions",
    mapping: {
      terraform: "google_cloudfunctions_function",
    },
  },
  {
    componentType: "serverless",
    technologyId: "azure-functions",
    mapping: {
      terraform: "azurerm_function_app",
    },
  },
];

// -- Networking --
const NETWORKING_ENTRIES: MappingEntry[] = [
  {
    componentType: "api-gateway",
    technologyId: "aws-api-gateway",
    mapping: {
      cfn: "AWS::ApiGateway::RestApi",
      terraform: "aws_api_gateway_rest_api",
      k8s: { kind: "Ingress", apiVersion: "networking.k8s.io/v1" },
      cdk: { module: "aws-cdk-lib/aws-apigateway", construct: "RestApi" },
      pulumi: { module: "@pulumi/aws", resource: "apigateway.RestApi" },
    },
  },
  {
    componentType: "api-gateway",
    technologyId: "nginx",
    mapping: {
      k8s: { kind: "Ingress", apiVersion: "networking.k8s.io/v1" },
      docker: "nginx:alpine",
    },
  },
  {
    componentType: "api-gateway",
    technologyId: "kong",
    mapping: {
      k8s: { kind: "Ingress", apiVersion: "networking.k8s.io/v1" },
      docker: "kong:3-alpine",
    },
  },
  {
    componentType: "api-gateway",
    technologyId: "envoy",
    mapping: {
      k8s: { kind: "Ingress", apiVersion: "networking.k8s.io/v1" },
      docker: "envoyproxy/envoy:v1.29-latest",
    },
  },
  {
    componentType: "load-balancer",
    technologyId: "aws-alb",
    mapping: {
      cfn: "AWS::ElasticLoadBalancingV2::LoadBalancer",
      terraform: "aws_lb",
      k8s: { kind: "Ingress", apiVersion: "networking.k8s.io/v1" },
      cdk: {
        module: "aws-cdk-lib/aws-elasticloadbalancingv2",
        construct: "ApplicationLoadBalancer",
      },
      pulumi: { module: "@pulumi/aws", resource: "lb.LoadBalancer" },
    },
  },
  {
    componentType: "load-balancer",
    technologyId: "nginx",
    mapping: {
      k8s: { kind: "Ingress", apiVersion: "networking.k8s.io/v1" },
      docker: "nginx:alpine",
    },
  },
  {
    componentType: "cdn",
    technologyId: "cloudfront",
    mapping: {
      cfn: "AWS::CloudFront::Distribution",
      terraform: "aws_cloudfront_distribution",
      cdk: { module: "aws-cdk-lib/aws-cloudfront", construct: "Distribution" },
      pulumi: { module: "@pulumi/aws", resource: "cloudfront.Distribution" },
    },
  },
  {
    componentType: "firewall",
    technologyId: "aws-waf",
    mapping: {
      cfn: "AWS::WAFv2::WebACL",
      terraform: "aws_wafv2_web_acl",
      k8s: { kind: "NetworkPolicy", apiVersion: "networking.k8s.io/v1" },
      cdk: { module: "aws-cdk-lib/aws-wafv2", construct: "CfnWebACL" },
      pulumi: { module: "@pulumi/aws", resource: "wafv2.WebAcl" },
    },
  },
  {
    componentType: "dns",
    technologyId: "route53",
    mapping: {
      cfn: "AWS::Route53::HostedZone",
      terraform: "aws_route53_zone",
      cdk: { module: "aws-cdk-lib/aws-route53", construct: "HostedZone" },
      pulumi: { module: "@pulumi/aws", resource: "route53.Zone" },
    },
  },
];

// -- Compute --
const COMPUTE_ENTRIES: MappingEntry[] = [
  {
    componentType: "service",
    technologyId: "nodejs",
    mapping: {
      k8s: { kind: "Deployment", apiVersion: "apps/v1" },
      docker: "node:20-alpine",
    },
  },
  {
    componentType: "service",
    technologyId: "go",
    mapping: {
      k8s: { kind: "Deployment", apiVersion: "apps/v1" },
      docker: "golang:1.22-alpine",
    },
  },
  {
    componentType: "service",
    technologyId: "java-spring",
    mapping: {
      k8s: { kind: "Deployment", apiVersion: "apps/v1" },
      docker: "eclipse-temurin:21-jre-alpine",
    },
  },
  {
    componentType: "service",
    technologyId: "python-fastapi",
    mapping: {
      k8s: { kind: "Deployment", apiVersion: "apps/v1" },
      docker: "python:3.12-slim",
    },
  },
  {
    componentType: "container-orchestration",
    technologyId: "kubernetes",
    mapping: {
      cfn: "AWS::EKS::Cluster",
      terraform: "aws_eks_cluster",
      cdk: { module: "aws-cdk-lib/aws-eks", construct: "Cluster" },
      pulumi: { module: "@pulumi/aws", resource: "eks.Cluster" },
    },
  },
  {
    componentType: "container-orchestration",
    technologyId: "ecs",
    mapping: {
      cfn: "AWS::ECS::Cluster",
      terraform: "aws_ecs_cluster",
      cdk: { module: "aws-cdk-lib/aws-ecs", construct: "Cluster" },
      pulumi: { module: "@pulumi/aws", resource: "ecs.Cluster" },
    },
  },
];

// -- Other --
const OTHER_ENTRIES: MappingEntry[] = [
  {
    componentType: "search-engine",
    technologyId: "elasticsearch",
    mapping: {
      cfn: "AWS::Elasticsearch::Domain",
      terraform: "aws_elasticsearch_domain",
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "elasticsearch:8.12.0",
      cdk: { module: "aws-cdk-lib/aws-elasticsearch", construct: "Domain" },
    },
  },
  {
    componentType: "search-engine",
    technologyId: "opensearch",
    mapping: {
      cfn: "AWS::OpenSearchService::Domain",
      terraform: "aws_opensearch_domain",
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "opensearchproject/opensearch:2",
    },
  },
  {
    componentType: "data-warehouse",
    technologyId: "redshift",
    mapping: {
      cfn: "AWS::Redshift::Cluster",
      terraform: "aws_redshift_cluster",
      cdk: { module: "aws-cdk-lib/aws-redshift", construct: "CfnCluster" },
      pulumi: { module: "@pulumi/aws", resource: "redshift.Cluster" },
    },
  },
  {
    componentType: "data-warehouse",
    technologyId: "bigquery",
    mapping: {
      terraform: "google_bigquery_dataset",
    },
  },
  {
    componentType: "stream-processor",
    technologyId: "kinesis",
    mapping: {
      cfn: "AWS::Kinesis::Stream",
      terraform: "aws_kinesis_stream",
      cdk: { module: "aws-cdk-lib/aws-kinesis", construct: "Stream" },
      pulumi: { module: "@pulumi/aws", resource: "kinesis.Stream" },
    },
  },
  {
    componentType: "stream-processor",
    technologyId: "flink",
    mapping: {
      k8s: { kind: "Deployment", apiVersion: "apps/v1" },
      docker: "flink:1.18",
    },
  },
  {
    componentType: "cron",
    technologyId: "eventbridge",
    mapping: {
      cfn: "AWS::Events::Rule",
      terraform: "aws_cloudwatch_event_rule",
      k8s: { kind: "CronJob", apiVersion: "batch/v1" },
      cdk: { module: "aws-cdk-lib/aws-events", construct: "Rule" },
      pulumi: { module: "@pulumi/aws", resource: "cloudwatch.EventRule" },
    },
  },
  {
    componentType: "webhook",
    technologyId: "sns",
    mapping: {
      cfn: "AWS::SNS::Topic",
      terraform: "aws_sns_topic",
      cdk: { module: "aws-cdk-lib/aws-sns", construct: "Topic" },
      pulumi: { module: "@pulumi/aws", resource: "sns.Topic" },
    },
  },
];

// Combine all entries
const ALL_ENTRIES: MappingEntry[] = [
  ...DB_ENTRIES,
  ...CACHE_ENTRIES,
  ...QUEUE_ENTRIES,
  ...STORAGE_ENTRIES,
  ...SERVERLESS_ENTRIES,
  ...NETWORKING_ENTRIES,
  ...COMPUTE_ENTRIES,
  ...OTHER_ENTRIES,
];

// Build lookup map: "componentType:technologyId" -> ResourceMapping
const MAPPING_INDEX = new Map<string, ResourceMapping>();
for (const entry of ALL_ENTRIES) {
  MAPPING_INDEX.set(`${entry.componentType}:${entry.technologyId}`, entry.mapping);
}

/**
 * Look up the resource mapping for a given component type and technology.
 * Falls back to a generic mapping by component type if no specific tech mapping exists.
 */
export function getResourceMapping(
  componentType: ComponentType,
  technologyId: string,
): ResourceMapping | undefined {
  return MAPPING_INDEX.get(`${componentType}:${technologyId}`);
}

/**
 * Get the first available mapping for a component type (any technology).
 * Useful as a fallback when no specific technology is selected.
 */
export function getDefaultMapping(componentType: ComponentType): ResourceMapping | undefined {
  for (const entry of ALL_ENTRIES) {
    if (entry.componentType === componentType) return entry.mapping;
  }
  return undefined;
}

/** Reverse lookup: find componentType from a CloudFormation resource type */
export function cfnToComponentType(
  cfnType: string,
): { componentType: ComponentType; technologyId: string } | undefined {
  for (const entry of ALL_ENTRIES) {
    if (entry.mapping.cfn === cfnType) {
      return { componentType: entry.componentType, technologyId: entry.technologyId };
    }
  }
  return undefined;
}

/** Reverse lookup: find componentType from a Terraform resource type */
export function terraformToComponentType(
  tfType: string,
): { componentType: ComponentType; technologyId: string } | undefined {
  for (const entry of ALL_ENTRIES) {
    if (entry.mapping.terraform === tfType) {
      return { componentType: entry.componentType, technologyId: entry.technologyId };
    }
  }
  return undefined;
}

/** Reverse lookup: find componentType from a Kubernetes kind */
export function k8sToComponentType(
  kind: string,
): { componentType: ComponentType; technologyId: string } | undefined {
  for (const entry of ALL_ENTRIES) {
    if (entry.mapping.k8s?.kind === kind) {
      return { componentType: entry.componentType, technologyId: entry.technologyId };
    }
  }
  return undefined;
}

/** Reverse lookup: find componentType from a Docker image */
export function dockerToComponentType(
  image: string,
): { componentType: ComponentType; technologyId: string } | undefined {
  const imageName = image.split(":")[0];
  for (const entry of ALL_ENTRIES) {
    if (entry.mapping.docker && entry.mapping.docker.split(":")[0] === imageName) {
      return { componentType: entry.componentType, technologyId: entry.technologyId };
    }
  }
  return undefined;
}
