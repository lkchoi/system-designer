import type { ClientConcern } from "../types";

export const mysqlConcern: ClientConcern = {
  targetTechId: "mysql",
  envVars: ["DATABASE_URL"],
  snippet: {
    node: {
      deps: { mysql2: "^3.11.5" },
      imports: ['import mysql from "mysql2/promise";'],
      globals: ["const mysqlPool = mysql.createPool(process.env.DATABASE_URL);"],
      init: [],
      shutdown: ["await mysqlPool.end();"],
      healthChecks: ['await mysqlPool.query("SELECT 1");'],
    },
    python: {
      deps: { PyMySQL: "1.1.1" },
      imports: ["import os", "import pymysql"],
      globals: [
        '_mysql_conn = pymysql.connect(host=os.environ.get("DB_HOST", "localhost"), port=int(os.environ.get("DB_PORT", "3306")), user=os.environ.get("DB_USER", "root"), password=os.environ.get("DB_PASSWORD", ""), database=os.environ.get("DB_NAME", "app"))',
      ],
      init: [],
      shutdown: ["_mysql_conn.close()"],
      healthChecks: ["_mysql_conn.ping(reconnect=True)"],
    },
    go: {
      deps: { "github.com/go-sql-driver/mysql": "v1.8.1" },
      imports: ['"database/sql"', '_ "github.com/go-sql-driver/mysql"'],
      globals: ["var mysqlDB *sql.DB"],
      init: [
        "{",
        '\tdb, err := sql.Open("mysql", os.Getenv("DATABASE_URL"))',
        '\tif err != nil { log.Fatalf("mysql: %v", err) }',
        "\tmysqlDB = db",
        "}",
      ],
      shutdown: ["mysqlDB.Close()"],
      healthChecks: ["mysqlDB.Ping()"],
    },
  },
};
