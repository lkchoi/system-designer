import type { TechConnectionRule } from "../connections";

/**
 * Layer 2: Technology-to-technology connection overrides.
 *
 * Each entry overrides Layer 1 component defaults for a specific
 * (sourceTech, targetTech) pair. sourceTech "*" means "any compute runtime".
 *
 * Fields:
 *   envVars   — env var templates with {HOST}, {PORT}, etc. tokens
 *   iac       — IAM actions, CDK grants, security group ports
 *   allowed   — false to block the pair entirely
 */
export const TECH_RULES: readonly TechConnectionRule[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // Compute → Database
  // ═══════════════════════════════════════════════════════════════════════

  {
    sourceTech: "*",
    targetTech: "postgresql",
    port: 5432,
    envVars: {
      DB_HOST: "{HOST}",
      DB_PORT: "{PORT}",
      DB_USER: "{USER}",
      DB_PASSWORD: "{PASSWORD}",
      DB_NAME: "{DB_NAME}",
      DATABASE_URL: "postgres://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB_NAME}",
    },
    iac: {
      iamActions: ["rds-db:connect"],
      cdkGrant: "grantConnect",
      pulumiGrant: "grantConnect",
      securityGroupPorts: [{ port: 5432, protocol: "tcp" }],
      k8sPort: 5432,
    },
  },
  {
    sourceTech: "*",
    targetTech: "mysql",
    port: 3306,
    envVars: {
      DB_HOST: "{HOST}",
      DB_PORT: "{PORT}",
      DB_USER: "{USER}",
      DB_PASSWORD: "{PASSWORD}",
      DB_NAME: "{DB_NAME}",
      DATABASE_URL: "mysql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB_NAME}",
    },
    iac: {
      iamActions: ["rds-db:connect"],
      cdkGrant: "grantConnect",
      pulumiGrant: "grantConnect",
      securityGroupPorts: [{ port: 3306, protocol: "tcp" }],
      k8sPort: 3306,
    },
  },
  {
    sourceTech: "*",
    targetTech: "mariadb",
    port: 3306,
    envVars: {
      DB_HOST: "{HOST}",
      DB_PORT: "{PORT}",
      DB_USER: "{USER}",
      DB_PASSWORD: "{PASSWORD}",
      DB_NAME: "{DB_NAME}",
      DATABASE_URL: "mysql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB_NAME}",
    },
    iac: {
      iamActions: ["rds-db:connect"],
      cdkGrant: "grantConnect",
      pulumiGrant: "grantConnect",
      securityGroupPorts: [{ port: 3306, protocol: "tcp" }],
      k8sPort: 3306,
    },
  },
  {
    sourceTech: "*",
    targetTech: "mongodb",
    port: 27017,
    envVars: {
      MONGO_HOST: "{HOST}",
      MONGO_PORT: "{PORT}",
      MONGO_DB: "{DB_NAME}",
      MONGO_URL: "mongodb://{HOST}:{PORT}/{DB_NAME}",
    },
    iac: {
      securityGroupPorts: [{ port: 27017, protocol: "tcp" }],
      k8sPort: 27017,
    },
  },
  {
    sourceTech: "*",
    targetTech: "dynamodb",
    protocol: "HTTPS",
    format: "JSON",
    iac: {
      iamActions: [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:DeleteItem",
        "dynamodb:UpdateItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:BatchGetItem",
      ],
      cdkGrant: "grantReadWriteData",
      pulumiGrant: "grantReadWriteData",
    },
  },
  {
    sourceTech: "*",
    targetTech: "cassandra",
    port: 9042,
    envVars: {
      CASSANDRA_HOST: "{HOST}",
      CASSANDRA_PORT: "{PORT}",
    },
    iac: {
      securityGroupPorts: [{ port: 9042, protocol: "tcp" }],
      k8sPort: 9042,
    },
  },
  {
    sourceTech: "*",
    targetTech: "cockroachdb",
    port: 26257,
    envVars: {
      DB_HOST: "{HOST}",
      DB_PORT: "{PORT}",
      DB_USER: "{USER}",
      DB_PASSWORD: "{PASSWORD}",
      DB_NAME: "{DB_NAME}",
      DATABASE_URL: "postgres://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB_NAME}",
    },
    iac: {
      securityGroupPorts: [{ port: 26257, protocol: "tcp" }],
      k8sPort: 26257,
    },
  },
  {
    sourceTech: "*",
    targetTech: "aurora",
    port: 5432,
    envVars: {
      DB_HOST: "{HOST}",
      DB_PORT: "{PORT}",
      DB_USER: "{USER}",
      DB_PASSWORD: "{PASSWORD}",
      DB_NAME: "{DB_NAME}",
      DATABASE_URL: "postgres://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB_NAME}",
    },
    iac: {
      iamActions: ["rds-db:connect", "rds-data:ExecuteStatement"],
      cdkGrant: "grantDataApiAccess",
      pulumiGrant: "grantDataApiAccess",
      securityGroupPorts: [{ port: 5432, protocol: "tcp" }],
      k8sPort: 5432,
    },
  },
  {
    sourceTech: "*",
    targetTech: "sql-server",
    port: 1433,
    envVars: {
      DB_HOST: "{HOST}",
      DB_PORT: "{PORT}",
      DB_USER: "{USER}",
      DB_PASSWORD: "{PASSWORD}",
      DB_NAME: "{DB_NAME}",
      DATABASE_URL: "sqlserver://{USER}:{PASSWORD}@{HOST}:{PORT};database={DB_NAME}",
    },
    iac: {
      iamActions: ["rds-db:connect"],
      cdkGrant: "grantConnect",
      pulumiGrant: "grantConnect",
      securityGroupPorts: [{ port: 1433, protocol: "tcp" }],
      k8sPort: 1433,
    },
  },
  {
    sourceTech: "*",
    targetTech: "neo4j",
    port: 7687,
    envVars: {
      NEO4J_URI: "bolt://{HOST}:{PORT}",
      NEO4J_USER: "{USER}",
      NEO4J_PASSWORD: "{PASSWORD}",
    },
    iac: {
      securityGroupPorts: [{ port: 7687, protocol: "tcp" }],
      k8sPort: 7687,
    },
  },
  {
    sourceTech: "*",
    targetTech: "firestore",
    protocol: "HTTPS",
    format: "JSON",
    envVars: {
      GCP_PROJECT: "{PROJECT}",
      FIRESTORE_DATABASE: "{DB_NAME}",
    },
  },
  {
    sourceTech: "*",
    targetTech: "cosmos-db",
    protocol: "HTTPS",
    format: "JSON",
    envVars: {
      COSMOS_ENDPOINT: "{ENDPOINT}",
      COSMOS_KEY: "{API_KEY}",
      COSMOS_DATABASE: "{DB_NAME}",
    },
  },
  {
    sourceTech: "*",
    targetTech: "influxdb",
    port: 8086,
    protocol: "HTTP",
    format: "JSON",
    envVars: {
      INFLUXDB_URL: "http://{HOST}:{PORT}",
      INFLUXDB_TOKEN: "{API_KEY}",
      INFLUXDB_ORG: "{USER}",
      INFLUXDB_BUCKET: "{BUCKET}",
    },
    iac: {
      securityGroupPorts: [{ port: 8086, protocol: "tcp" }],
      k8sPort: 8086,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Compute → Cache
  // ═══════════════════════════════════════════════════════════════════════

  {
    sourceTech: "*",
    targetTech: "redis",
    port: 6379,
    envVars: {
      REDIS_URL: "redis://{HOST}:{PORT}",
    },
    iac: {
      iamActions: ["elasticache:Connect"],
      securityGroupPorts: [{ port: 6379, protocol: "tcp" }],
      k8sPort: 6379,
    },
  },
  {
    sourceTech: "*",
    targetTech: "memcached",
    port: 11211,
    envVars: {
      MEMCACHED_HOST: "{HOST}",
      MEMCACHED_PORT: "{PORT}",
    },
    iac: {
      iamActions: ["elasticache:Connect"],
      securityGroupPorts: [{ port: 11211, protocol: "tcp" }],
      k8sPort: 11211,
    },
  },
  {
    sourceTech: "*",
    targetTech: "dragonfly",
    port: 6379,
    envVars: {
      REDIS_URL: "redis://{HOST}:{PORT}",
    },
    iac: {
      securityGroupPorts: [{ port: 6379, protocol: "tcp" }],
      k8sPort: 6379,
    },
  },
  {
    sourceTech: "*",
    targetTech: "keydb",
    port: 6379,
    envVars: {
      REDIS_URL: "redis://{HOST}:{PORT}",
    },
    iac: {
      securityGroupPorts: [{ port: 6379, protocol: "tcp" }],
      k8sPort: 6379,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Compute → Message Queue
  // ═══════════════════════════════════════════════════════════════════════

  {
    sourceTech: "*",
    targetTech: "kafka",
    port: 9092,
    protocol: "TCP",
    format: "Binary",
    envVars: {
      KAFKA_BOOTSTRAP_SERVERS: "{HOST}:{PORT}",
    },
    iac: {
      iamActions: [
        "kafka-cluster:Connect",
        "kafka-cluster:AlterGroup",
        "kafka-cluster:ReadData",
        "kafka-cluster:WriteData",
      ],
      securityGroupPorts: [{ port: 9092, protocol: "tcp" }],
      k8sPort: 9092,
    },
  },
  {
    sourceTech: "*",
    targetTech: "sqs",
    protocol: "HTTPS",
    format: "JSON",
    envVars: {
      SQS_QUEUE_URL: "https://sqs.{REGION}.amazonaws.com/{ACCOUNT}/{QUEUE_NAME}",
    },
    iac: {
      iamActions: [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
      ],
      cdkGrant: "grantSendMessages",
      pulumiGrant: "grantSendMessages",
    },
  },
  {
    sourceTech: "*",
    targetTech: "rabbitmq",
    port: 5672,
    protocol: "AMQP",
    format: "JSON",
    envVars: {
      RABBITMQ_URL: "amqp://{USER}:{PASSWORD}@{HOST}:{PORT}",
    },
    iac: {
      securityGroupPorts: [{ port: 5672, protocol: "tcp" }],
      k8sPort: 5672,
    },
  },
  {
    sourceTech: "*",
    targetTech: "nats",
    port: 4222,
    envVars: {
      NATS_URL: "nats://{HOST}:{PORT}",
    },
    iac: {
      securityGroupPorts: [{ port: 4222, protocol: "tcp" }],
      k8sPort: 4222,
    },
  },
  {
    sourceTech: "*",
    targetTech: "google-pubsub",
    protocol: "HTTPS",
    format: "JSON",
    envVars: {
      PUBSUB_PROJECT_ID: "{PROJECT}",
      PUBSUB_TOPIC: "{TOPIC}",
    },
    iac: {
      iamActions: ["pubsub.topics.publish", "pubsub.subscriptions.consume"],
    },
  },
  {
    sourceTech: "*",
    targetTech: "pulsar",
    port: 6650,
    protocol: "TCP",
    format: "Binary",
    envVars: {
      PULSAR_URL: "pulsar://{HOST}:{PORT}",
    },
    iac: {
      securityGroupPorts: [{ port: 6650, protocol: "tcp" }],
      k8sPort: 6650,
    },
  },
  {
    sourceTech: "*",
    targetTech: "azure-service-bus",
    protocol: "AMQP",
    format: "JSON",
    envVars: {
      SERVICEBUS_CONNECTION_STRING: "{CONNECTION_STRING}",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Compute → Storage
  // ═══════════════════════════════════════════════════════════════════════

  {
    sourceTech: "*",
    targetTech: "s3",
    protocol: "HTTPS",
    format: "Binary",
    envVars: {
      S3_BUCKET: "{BUCKET}",
      AWS_REGION: "{REGION}",
    },
    iac: {
      iamActions: [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
      ],
      cdkGrant: "grantReadWrite",
      pulumiGrant: "grantReadWrite",
    },
  },
  {
    sourceTech: "*",
    targetTech: "minio",
    port: 9000,
    protocol: "HTTP",
    format: "Binary",
    envVars: {
      S3_ENDPOINT: "http://{HOST}:{PORT}",
      S3_ACCESS_KEY: "{USER}",
      S3_SECRET_KEY: "{PASSWORD}",
      S3_BUCKET: "{BUCKET}",
      AWS_ENDPOINT_URL: "http://{HOST}:{PORT}",
    },
    iac: {
      securityGroupPorts: [{ port: 9000, protocol: "tcp" }],
      k8sPort: 9000,
    },
  },
  {
    sourceTech: "*",
    targetTech: "gcs",
    protocol: "HTTPS",
    format: "Binary",
    envVars: {
      GCS_BUCKET: "{BUCKET}",
      GCP_PROJECT: "{PROJECT}",
    },
    iac: {
      iamActions: [
        "storage.objects.get",
        "storage.objects.create",
        "storage.objects.delete",
        "storage.objects.list",
      ],
    },
  },
  {
    sourceTech: "*",
    targetTech: "r2",
    protocol: "HTTPS",
    format: "Binary",
    envVars: {
      R2_ENDPOINT: "{ENDPOINT}",
      R2_ACCESS_KEY: "{USER}",
      R2_SECRET_KEY: "{PASSWORD}",
      R2_BUCKET: "{BUCKET}",
    },
  },
  {
    sourceTech: "*",
    targetTech: "azure-blob",
    protocol: "HTTPS",
    format: "Binary",
    envVars: {
      AZURE_STORAGE_CONNECTION_STRING: "{CONNECTION_STRING}",
      AZURE_CONTAINER: "{CONTAINER}",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Compute → Search
  // ═══════════════════════════════════════════════════════════════════════

  {
    sourceTech: "*",
    targetTech: "elasticsearch",
    port: 9200,
    protocol: "HTTP",
    format: "JSON",
    envVars: {
      ES_URL: "http://{HOST}:{PORT}",
    },
    iac: {
      iamActions: ["es:ESHttpGet", "es:ESHttpPut", "es:ESHttpPost"],
      securityGroupPorts: [{ port: 9200, protocol: "tcp" }],
      k8sPort: 9200,
    },
  },
  {
    sourceTech: "*",
    targetTech: "opensearch",
    port: 9200,
    protocol: "HTTP",
    format: "JSON",
    envVars: {
      ES_URL: "http://{HOST}:{PORT}",
    },
    iac: {
      iamActions: ["es:ESHttpGet", "es:ESHttpPut", "es:ESHttpPost"],
      securityGroupPorts: [{ port: 9200, protocol: "tcp" }],
      k8sPort: 9200,
    },
  },
  {
    sourceTech: "*",
    targetTech: "typesense",
    port: 8108,
    protocol: "HTTP",
    format: "JSON",
    envVars: {
      TYPESENSE_URL: "http://{HOST}:{PORT}",
      TYPESENSE_API_KEY: "{API_KEY}",
    },
    iac: {
      securityGroupPorts: [{ port: 8108, protocol: "tcp" }],
      k8sPort: 8108,
    },
  },
  {
    sourceTech: "*",
    targetTech: "meilisearch",
    port: 7700,
    protocol: "HTTP",
    format: "JSON",
    envVars: {
      MEILI_URL: "http://{HOST}:{PORT}",
      MEILI_MASTER_KEY: "{API_KEY}",
    },
    iac: {
      securityGroupPorts: [{ port: 7700, protocol: "tcp" }],
      k8sPort: 7700,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Compute → Data Warehouse
  // ═══════════════════════════════════════════════════════════════════════

  {
    sourceTech: "*",
    targetTech: "clickhouse",
    port: 8123,
    protocol: "HTTP",
    format: "JSON",
    envVars: {
      WAREHOUSE_URL: "http://{HOST}:{PORT}",
    },
    iac: {
      securityGroupPorts: [{ port: 8123, protocol: "tcp" }],
      k8sPort: 8123,
    },
  },
  {
    sourceTech: "*",
    targetTech: "snowflake",
    protocol: "HTTPS",
    format: "JSON",
    envVars: {
      SNOWFLAKE_ACCOUNT: "{ACCOUNT}",
      SNOWFLAKE_USER: "{USER}",
      SNOWFLAKE_PASSWORD: "{PASSWORD}",
    },
  },
  {
    sourceTech: "*",
    targetTech: "bigquery",
    protocol: "HTTPS",
    format: "JSON",
    envVars: {
      GCP_PROJECT: "{PROJECT}",
      BQ_DATASET: "{DATASET}",
    },
    iac: {
      iamActions: [
        "bigquery.tables.getData",
        "bigquery.tables.updateData",
        "bigquery.jobs.create",
      ],
    },
  },
  {
    sourceTech: "*",
    targetTech: "redshift",
    port: 5439,
    envVars: {
      DATABASE_URL: "redshift://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB_NAME}",
    },
    iac: {
      iamActions: ["redshift:GetClusterCredentials", "redshift-data:ExecuteStatement"],
      securityGroupPorts: [{ port: 5439, protocol: "tcp" }],
      k8sPort: 5439,
    },
  },
  {
    sourceTech: "*",
    targetTech: "duckdb",
    envVars: {
      DUCKDB_PATH: "{DB_NAME}",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Networking → Compute (IaC only, no env vars)
  // ═══════════════════════════════════════════════════════════════════════

  {
    sourceTech: "aws-api-gateway",
    targetTech: "lambda",
    protocol: "HTTPS",
    format: "JSON",
    label: "invokes",
    iac: {
      iamActions: ["lambda:InvokeFunction"],
      cdkGrant: "grantInvoke",
      pulumiGrant: "grantInvoke",
    },
  },
  {
    sourceTech: "cloudfront",
    targetTech: "s3",
    protocol: "HTTPS",
    format: "Binary",
    label: "origin",
    iac: {
      iamActions: ["s3:GetObject"],
      cdkGrant: "grantRead",
      pulumiGrant: "grantRead",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Stream Processing
  // ═══════════════════════════════════════════════════════════════════════

  {
    sourceTech: "*",
    targetTech: "kinesis-streams",
    protocol: "HTTPS",
    format: "JSON",
    envVars: {
      KINESIS_STREAM_NAME: "{TOPIC}",
      AWS_REGION: "{REGION}",
    },
    iac: {
      iamActions: [
        "kinesis:PutRecord",
        "kinesis:PutRecords",
        "kinesis:GetRecords",
        "kinesis:GetShardIterator",
        "kinesis:DescribeStream",
      ],
      cdkGrant: "grantReadWrite",
      pulumiGrant: "grantReadWrite",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Blocked pairs — Cloudflare Workers
  // ═══════════════════════════════════════════════════════════════════════

  {
    sourceTech: "cf-workers",
    targetTech: "aurora",
    allowed: false,
    blockedReason: "Workers cannot reach VPC resources — use D1, Turso, or PlanetScale",
  },
  {
    sourceTech: "cf-workers",
    targetTech: "postgresql",
    allowed: false,
    blockedReason: "Workers lack TCP socket support — use Neon HTTP driver or Hyperdrive",
  },
  {
    sourceTech: "cf-workers",
    targetTech: "mysql",
    allowed: false,
    blockedReason: "Workers lack TCP socket support — use PlanetScale HTTP driver",
  },
  {
    sourceTech: "cf-workers",
    targetTech: "mariadb",
    allowed: false,
    blockedReason: "Workers lack TCP socket support",
  },
  {
    sourceTech: "cf-workers",
    targetTech: "redis",
    allowed: false,
    blockedReason: "Workers lack TCP sockets — use Upstash REST API",
  },
  {
    sourceTech: "cf-workers",
    targetTech: "kafka",
    allowed: false,
    blockedReason: "Workers lack TCP sockets — use Upstash Kafka REST",
  },
  {
    sourceTech: "cf-workers",
    targetTech: "cassandra",
    allowed: false,
    blockedReason: "Workers lack TCP sockets",
  },
  {
    sourceTech: "cf-workers",
    targetTech: "mongodb",
    allowed: false,
    blockedReason: "Workers lack TCP sockets — use MongoDB Atlas Data API",
  },
  {
    sourceTech: "cf-workers",
    targetTech: "rabbitmq",
    allowed: false,
    blockedReason: "Workers lack AMQP support — use CloudAMQP REST API",
  },
  {
    sourceTech: "cf-workers",
    targetTech: "sql-server",
    allowed: false,
    blockedReason: "Workers lack TCP socket support",
  },
  {
    sourceTech: "cf-workers",
    targetTech: "cockroachdb",
    allowed: false,
    blockedReason: "Workers lack TCP socket support — use CockroachDB Serverless HTTP API",
  },
  {
    sourceTech: "cf-workers",
    targetTech: "neo4j",
    allowed: false,
    blockedReason: "Workers lack Bolt protocol support",
  },
  {
    sourceTech: "cf-workers",
    targetTech: "nats",
    allowed: false,
    blockedReason: "Workers lack TCP sockets",
  },
];
