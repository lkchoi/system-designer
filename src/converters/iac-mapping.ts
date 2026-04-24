import type { ComponentType } from "../types";
import { getTechnology } from "../technologies";

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
  /** Default in-container port(s) the docker image listens on. */
  defaultPorts?: number[];
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
      docker: "postgres:17-alpine",
      defaultPorts: [5432],
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
      docker: "mysql:9",
      defaultPorts: [3306],
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
      docker: "mongo:8",
      defaultPorts: [27017],
    },
  },
  {
    componentType: "database",
    technologyId: "dynamodb",
    mapping: {
      cfn: "AWS::DynamoDB::Table",
      terraform: "aws_dynamodb_table",
      docker: "amazon/dynamodb-local:latest",
      defaultPorts: [8000],
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
      docker: "cassandra:5",
      defaultPorts: [9042],
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
      docker: "cockroachdb/cockroach:v24.3",
      defaultPorts: [26257],
    },
  },
  {
    componentType: "database",
    technologyId: "sql-server",
    mapping: {
      cfn: "AWS::RDS::DBInstance",
      terraform: "aws_db_instance",
      docker: "mcr.microsoft.com/mssql/server:2022-latest",
      defaultPorts: [1433],
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
      docker: "redis:8-alpine",
      defaultPorts: [6379],
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
      docker: "memcached:1.6-alpine",
      defaultPorts: [11211],
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
      docker: "confluentinc/cp-kafka:7.9.0",
      defaultPorts: [9092],
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
      defaultPorts: [9324],
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
      docker: "rabbitmq:4-management-alpine",
      defaultPorts: [5672, 15672],
    },
  },
  {
    componentType: "message-queue",
    technologyId: "redis",
    mapping: {
      k8s: { kind: "Deployment", apiVersion: "apps/v1" },
      docker: "redis:8-alpine",
      defaultPorts: [6379],
    },
  },
  {
    componentType: "message-queue",
    technologyId: "nats",
    mapping: {
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "nats:2.11-alpine",
      defaultPorts: [4222],
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
      docker: "minio/minio:RELEASE.2025-04-22T22-12-26Z",
      defaultPorts: [9000, 9001],
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
      docker: "nginx:1.27-alpine",
      defaultPorts: [80],
    },
  },
  {
    componentType: "api-gateway",
    technologyId: "kong",
    mapping: {
      k8s: { kind: "Ingress", apiVersion: "networking.k8s.io/v1" },
      docker: "kong:3.9",
      defaultPorts: [8000, 8443],
    },
  },
  {
    componentType: "api-gateway",
    technologyId: "envoy",
    mapping: {
      k8s: { kind: "Ingress", apiVersion: "networking.k8s.io/v1" },
      docker: "envoyproxy/envoy:v1.33-latest",
      defaultPorts: [10000, 9901],
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
      docker: "nginx:1.27-alpine",
      defaultPorts: [80],
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
      docker: "node:22-alpine",
      defaultPorts: [8080],
    },
  },
  {
    componentType: "service",
    technologyId: "go",
    mapping: {
      k8s: { kind: "Deployment", apiVersion: "apps/v1" },
      docker: "golang:1.24-alpine",
      defaultPorts: [8080],
    },
  },
  {
    componentType: "service",
    technologyId: "java-spring",
    mapping: {
      k8s: { kind: "Deployment", apiVersion: "apps/v1" },
      docker: "eclipse-temurin:21-jre-alpine",
      defaultPorts: [8080],
    },
  },
  {
    componentType: "service",
    technologyId: "python-fastapi",
    mapping: {
      k8s: { kind: "Deployment", apiVersion: "apps/v1" },
      docker: "python:3.13-slim",
      defaultPorts: [8000],
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
      docker: "elasticsearch:8.17.4",
      defaultPorts: [9200],
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
      docker: "opensearchproject/opensearch:2.19",
      defaultPorts: [9200],
    },
  },
  {
    componentType: "search-engine",
    technologyId: "meilisearch",
    mapping: {
      docker: "getmeili/meilisearch:v1.10",
      defaultPorts: [7700],
    },
  },
  {
    componentType: "search-engine",
    technologyId: "typesense",
    mapping: {
      docker: "typesense/typesense:0.25.2",
      defaultPorts: [8108],
    },
  },
  {
    componentType: "search-engine",
    technologyId: "solr",
    mapping: {
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "solr:9",
      defaultPorts: [8983],
    },
  },
  {
    componentType: "data-warehouse",
    technologyId: "clickhouse",
    mapping: {
      k8s: { kind: "StatefulSet", apiVersion: "apps/v1" },
      docker: "clickhouse/clickhouse-server:24",
      defaultPorts: [8123, 9000],
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
      docker: "flink:1.20",
      defaultPorts: [8081],
    },
  },
  {
    componentType: "stream-processor",
    technologyId: "risingwave",
    mapping: {
      docker: "risingwavelabs/risingwave:v2.0.0",
      defaultPorts: [4566],
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
    componentType: "cron",
    technologyId: "linux-cron",
    mapping: {
      docker: "mcuadros/ofelia:v0.3.16",
      defaultPorts: [],
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
  {
    componentType: "webhook",
    technologyId: "custom-webhook",
    mapping: {
      docker: "tarampampam/webhook-tester:1.1.0",
      defaultPorts: [8084],
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
 * Resolve a technology display name (e.g. "PostgreSQL") to its ID (e.g. "postgresql").
 * Returns the input unchanged if already an ID or not found in the catalog.
 */
export function resolveTechId(componentType: ComponentType, techNameOrId: string): string {
  // Try direct ID match first
  if (MAPPING_INDEX.has(`${componentType}:${techNameOrId}`)) return techNameOrId;
  // Resolve display name via technology catalog
  const info = getTechnology(componentType, techNameOrId);
  return info?.id ?? techNameOrId.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Look up the resource mapping for a given component type and technology.
 * Accepts both technology IDs ("postgresql") and display names ("PostgreSQL").
 */
export function getResourceMapping(
  componentType: ComponentType,
  techNameOrId: string,
): ResourceMapping | undefined {
  const id = resolveTechId(componentType, techNameOrId);
  return MAPPING_INDEX.get(`${componentType}:${id}`);
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

/**
 * Resolve the in-container ports a docker image listens on.
 * Falls back to [8080] when no specific mapping is registered.
 */
export function getDefaultPorts(componentType: ComponentType, techNameOrId: string): number[] {
  const mapping = getResourceMapping(componentType, techNameOrId);
  if (mapping?.defaultPorts && mapping.defaultPorts.length > 0) return mapping.defaultPorts;
  const fallback = getDefaultMapping(componentType);
  return fallback?.defaultPorts ?? [8080];
}

/**
 * Allocate a unique host port given a preferred in-container port.
 * Increments past collisions in the supplied set.
 */
export function allocateHostPort(preferred: number, used: Set<number>): number {
  let port = preferred;
  while (used.has(port)) port++;
  used.add(port);
  return port;
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
