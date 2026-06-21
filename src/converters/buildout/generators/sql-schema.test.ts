import { describe, expect, it } from "vitest";
import { sqlSchemaGenerator } from "./sql-schema";
import type { GeneratorContext } from "../types";

function ctx(plan: Record<string, string>): GeneratorContext {
  return {
    node: {
      id: "db1",
      label: "Orders DB",
      description: "",
      componentType: "database",
      plan,
      sharded: false,
      shardKey: "",
      endpoints: [],
      links: [],
      stressFailure: "none",
      capacityPercent: 0,
      consumerRate: 0,
    },
    inbound: [],
    outbound: [],
  };
}

describe("sqlSchemaGenerator", () => {
  it("supports SQL technologies", () => {
    expect(sqlSchemaGenerator.supports(ctx({ technology: "postgresql" }))).toBe(true);
    expect(sqlSchemaGenerator.supports(ctx({ technology: "mysql" }))).toBe(true);
    expect(sqlSchemaGenerator.supports(ctx({ technology: "sqlite" }))).toBe(true);
    expect(sqlSchemaGenerator.supports(ctx({ technology: "cockroachdb" }))).toBe(true);
  });

  it("rejects non-SQL technologies", () => {
    expect(sqlSchemaGenerator.supports(ctx({ technology: "dynamodb" }))).toBe(false);
    expect(sqlSchemaGenerator.supports(ctx({ technology: "mongodb" }))).toBe(false);
    expect(sqlSchemaGenerator.supports(ctx({ technology: "redis" }))).toBe(false);
  });

  it("emits a single file at schema.sql", async () => {
    const files = await sqlSchemaGenerator.generate(
      ctx({ technology: "postgresql", tables: "users" }),
    );
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("schema.sql");
  });

  it("emits stub for declared table when no columns YAML is present", async () => {
    const files = await sqlSchemaGenerator.generate(
      ctx({ technology: "postgresql", tables: "users", primaryKey: "id (UUID)" }),
    );
    expect(files[0].contents).toContain("CREATE TABLE IF NOT EXISTS users");
    // Stub preserves the case the user wrote in plan.primaryKey.
    expect(files[0].contents).toContain("id UUID PRIMARY KEY");
    expect(files[0].contents).toContain("TODO: populate plan.columns");
  });

  it("emits full DDL when columns YAML is provided", async () => {
    const columns = `
users:
  - { name: id, type: uuid, primary: true }
  - { name: email, type: text, nullable: false, unique: true }
  - { name: created_at, type: timestamptz, default: "now()" }
`.trim();
    const files = await sqlSchemaGenerator.generate(
      ctx({ technology: "postgresql", tables: "users", columns }),
    );
    const sql = files[0].contents;
    expect(sql).toContain("id uuid PRIMARY KEY");
    expect(sql).toContain("email text UNIQUE NOT NULL");
    expect(sql).toContain("created_at timestamptz");
    expect(sql).toContain("DEFAULT now()");
  });

  it("emits composite primary key when multiple columns are marked primary", async () => {
    const columns = `
user_roles:
  - { name: user_id, type: uuid, primary: true }
  - { name: role_id, type: uuid, primary: true }
`.trim();
    const files = await sqlSchemaGenerator.generate(
      ctx({ technology: "postgresql", tables: "user_roles", columns }),
    );
    const sql = files[0].contents;
    expect(sql).toContain("PRIMARY KEY (user_id, role_id)");
    // Per-column PRIMARY KEY clauses should be removed.
    expect(sql).not.toMatch(/user_id uuid PRIMARY KEY/);
  });

  it("remaps types for MySQL dialect", async () => {
    const columns = `
users:
  - { name: id, type: uuid, primary: true }
  - { name: data, type: jsonb }
`.trim();
    const files = await sqlSchemaGenerator.generate(
      ctx({ technology: "mysql", tables: "users", columns }),
    );
    const sql = files[0].contents;
    expect(sql).toContain("id CHAR(36)");
    expect(sql).toContain("data JSON");
  });

  it("emits FK references", async () => {
    const columns = `
orders:
  - { name: id, type: uuid, primary: true }
  - { name: user_id, type: uuid, nullable: false, references: "users(id)" }
`.trim();
    const files = await sqlSchemaGenerator.generate(
      ctx({ technology: "postgresql", tables: "orders", columns }),
    );
    expect(files[0].contents).toContain("REFERENCES users(id)");
  });

  it("renders indexes from plan.indexes", async () => {
    const files = await sqlSchemaGenerator.generate(
      ctx({
        technology: "postgresql",
        tables: "users",
        indexes: "email_idx, status_idx",
      }),
    );
    expect(files[0].contents).toContain("CREATE INDEX IF NOT EXISTS email_idx");
    expect(files[0].contents).toContain("CREATE INDEX IF NOT EXISTS status_idx");
  });

  it("warns when no tables are declared", async () => {
    const files = await sqlSchemaGenerator.generate(ctx({ technology: "postgresql" }));
    expect(files[0].contents).toContain("no tables declared");
  });

  it("survives malformed YAML", async () => {
    const files = await sqlSchemaGenerator.generate(
      ctx({
        technology: "postgresql",
        tables: "users",
        columns: "this is not yaml: : :",
      }),
    );
    // Should fall through to stub.
    expect(files[0].contents).toContain("TODO: populate plan.columns");
  });
});
