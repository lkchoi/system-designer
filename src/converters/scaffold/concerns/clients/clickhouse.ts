import type { ClientConcern } from "../types";

export const clickhouseConcern: ClientConcern = {
  targetTechId: "clickhouse",
  envVars: ["WAREHOUSE_URL"],
  snippet: {
    node: {
      deps: { "@clickhouse/client": "^1.8.1" },
      imports: ['import { createClient } from "@clickhouse/client";'],
      globals: [
        'const clickhouse = createClient({ url: process.env.WAREHOUSE_URL ?? "http://localhost:8123" });',
      ],
      init: [],
      shutdown: ["await clickhouse.close();"],
      healthChecks: ["await clickhouse.ping();"],
    },
    python: {
      deps: { "clickhouse-connect": "0.8.9" },
      imports: ["import os", "import clickhouse_connect"],
      globals: [
        '_ch = clickhouse_connect.get_client(host=os.environ.get("WAREHOUSE_URL", "http://localhost:8123").replace("http://", "").split(":")[0], port=int(os.environ.get("WAREHOUSE_URL", "http://localhost:8123").rsplit(":", 1)[-1]))',
      ],
      init: [],
      shutdown: ["_ch.close()"],
      healthChecks: ["_ch.ping()"],
    },
    go: {
      deps: { "github.com/ClickHouse/clickhouse-go/v2": "v2.30.0" },
      imports: ['"context"', '"github.com/ClickHouse/clickhouse-go/v2"'],
      globals: ["var chConn clickhouse.Conn"],
      init: [
        "{",
        '\tconn, err := clickhouse.Open(&clickhouse.Options{Addr: []string{os.Getenv("WAREHOUSE_URL")}})',
        '\tif err != nil { log.Fatalf("clickhouse: %v", err) }',
        "\tchConn = conn",
        "}",
      ],
      shutdown: ["chConn.Close()"],
      healthChecks: ["chConn.Ping(context.Background())"],
    },
  },
};
