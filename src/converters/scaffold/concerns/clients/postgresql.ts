import type { ClientConcern } from "../types";

export const postgresqlConcern: ClientConcern = {
  targetTechId: "postgresql",
  envVars: ["DATABASE_URL"],
  snippet: {
    node: {
      deps: { pg: "^8.13.1" },
      imports: ['import pg from "pg";'],
      globals: ["const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });"],
      init: [],
      shutdown: ["await pool.end();"],
      healthChecks: ['await pool.query("SELECT 1");'],
    },
    python: {
      deps: { "psycopg2-binary": "2.9.10" },
      imports: ["import os", "import psycopg2"],
      globals: ['_pg_conn = psycopg2.connect(os.environ["DATABASE_URL"])'],
      init: [],
      shutdown: ["_pg_conn.close()"],
      healthChecks: ["_pg_conn.cursor().execute('SELECT 1')"],
    },
    go: {
      deps: { "github.com/jackc/pgx/v5": "v5.7.2" },
      imports: ['"context"', '"github.com/jackc/pgx/v5/pgxpool"'],
      globals: ["var dbPool *pgxpool.Pool"],
      init: [
        'pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))',
        'if err != nil { log.Fatalf("postgres: %v", err) }',
        "dbPool = pool",
      ],
      shutdown: ["dbPool.Close()"],
      healthChecks: ["dbPool.Ping(context.Background())"],
    },
  },
};
