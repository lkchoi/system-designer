import type { ClientConcern } from "../types";
import { redisConcern } from "./redis";
import { postgresqlConcern } from "./postgresql";
import { mysqlConcern } from "./mysql";
import { mongodbConcern } from "./mongodb";
import { kafkaConcern } from "./kafka";
import { rabbitmqConcern } from "./rabbitmq";
import { natsConcern } from "./nats";
import { s3Concern } from "./s3";
import { elasticsearchConcern } from "./elasticsearch";
import { clickhouseConcern } from "./clickhouse";

/** All registered client concerns, keyed by targetTechId. */
export const CLIENT_CONCERNS: readonly ClientConcern[] = [
  redisConcern,
  postgresqlConcern,
  mysqlConcern,
  mongodbConcern,
  kafkaConcern,
  rabbitmqConcern,
  natsConcern,
  s3Concern,
  elasticsearchConcern,
  clickhouseConcern,
];

const byTechId = new Map<string, ClientConcern>();
for (const c of CLIENT_CONCERNS) byTechId.set(c.targetTechId, c);

/**
 * Wire-compatible tech aliases. Technologies that use the same client
 * library and protocol as a canonical tech.
 */
const TECH_ALIASES: Record<string, string> = {
  // PostgreSQL wire-compatible
  cockroachdb: "postgresql",
  aurora: "postgresql",
  // MySQL wire-compatible
  mariadb: "mysql",
  // Redis wire-compatible
  dragonfly: "redis",
  keydb: "redis",
  // OpenSearch uses the same client as Elasticsearch
  opensearch: "elasticsearch",
  // MinIO is S3-compatible
  minio: "s3",
};

/** Look up a client concern by target technology ID, with alias resolution. */
export function getClientConcern(targetTechId: string): ClientConcern | undefined {
  return byTechId.get(targetTechId) ?? byTechId.get(TECH_ALIASES[targetTechId]);
}
