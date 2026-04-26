import type { ClientConcern } from "../types";

export const redisConcern: ClientConcern = {
  targetTechId: "redis",
  envVars: ["REDIS_URL"],
  snippet: {
    node: {
      deps: { ioredis: "^5.4.1" },
      imports: ['import Redis from "ioredis";'],
      globals: ["const redis = new Redis(process.env.REDIS_URL);"],
      init: [],
      shutdown: ["await redis.quit();"],
      healthChecks: ["await redis.ping();"],
    },
    python: {
      deps: { redis: "5.2.1" },
      imports: ["import os", "import redis as _redis_mod"],
      globals: ['_redis = _redis_mod.from_url(os.environ["REDIS_URL"])'],
      init: [],
      shutdown: ["_redis.close()"],
      healthChecks: ["_redis.ping()"],
    },
    go: {
      deps: { "github.com/redis/go-redis/v9": "v9.7.0" },
      imports: ['"context"', '"github.com/redis/go-redis/v9"'],
      globals: ["var rdb *redis.Client"],
      init: [
        "{",
        '\topt, err := redis.ParseURL(os.Getenv("REDIS_URL"))',
        '\tif err != nil { log.Fatalf("redis: %v", err) }',
        "\trdb = redis.NewClient(opt)",
        "}",
      ],
      shutdown: ["rdb.Close()"],
      healthChecks: ["rdb.Ping(context.Background()).Err()"],
    },
  },
};
