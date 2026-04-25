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

/** Look up a client concern by target technology ID. */
export function getClientConcern(targetTechId: string): ClientConcern | undefined {
  return byTechId.get(targetTechId);
}
