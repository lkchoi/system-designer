/**
 * Deterministic SQL schema generator.
 *
 * Reads a `database` node and emits a `schema.sql` file with one
 * CREATE TABLE statement per declared table plus indexes and (optional)
 * foreign keys.
 *
 * Input shape (plan fields):
 *   - tables: comma-separated table names (existing string field)
 *   - primaryKey: e.g. "id (UUID)"
 *   - sortKey: e.g. "created_at"
 *   - indexes: comma-separated index hints, e.g. "email_idx, status_idx"
 *   - columns: OPTIONAL YAML string (structured) — preferred shape:
 *       <table-name>:
 *         - { name: id, type: uuid, primary: true }
 *         - { name: email, type: text, nullable: false, unique: true }
 *         - { name: created_at, type: timestamptz, default: "now()" }
 *
 * When `columns` is present we generate full DDL. When it's missing we
 * emit a stub with -- TODO markers tied to the existing string fields,
 * so designers see exactly which plan fields are needed to upgrade to
 * full DDL.
 *
 * Dialect: PostgreSQL by default; minor variations for MySQL, SQLite,
 * CockroachDB, TiDB. Other tech ids → emit a comment and skip.
 *
 * No LLM call — this is deterministic and free.
 */

import yaml from "js-yaml";
import type { Generator, GeneratorContext, GeneratedFile } from "../types";

type Dialect = "postgres" | "mysql" | "sqlite" | "tidb" | "cockroach";

interface Column {
  name: string;
  type: string;
  nullable?: boolean;
  primary?: boolean;
  unique?: boolean;
  default?: string;
  references?: string; // "other_table(other_col)"
}

const SQL_TECHS: Record<string, Dialect | undefined> = {
  postgresql: "postgres",
  mysql: "mysql",
  sqlite: "sqlite",
  tidb: "tidb",
  cockroachdb: "cockroach",
};

export const sqlSchemaGenerator: Generator = {
  kind: "deterministic",

  supports(ctx) {
    if (ctx.node.componentType !== "database") return false;
    const techId = ctx.node.plan?.technology;
    return !!techId && techId in SQL_TECHS;
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    const plan = ctx.node.plan ?? {};
    const dialect = SQL_TECHS[plan.technology ?? ""] ?? "postgres";
    const tables = parseTables(plan.tables ?? "");
    const columnsByTable = parseColumnsYaml(plan.columns);

    const lines: string[] = [];
    lines.push(`-- Generated SQL schema for ${ctx.node.label}`);
    lines.push(`-- Dialect: ${dialect}`);
    lines.push(`-- Source plan fields: technology, tables, primaryKey, sortKey, indexes, columns`);
    lines.push(``);

    if (tables.length === 0) {
      lines.push(`-- TODO: no tables declared in plan.tables. Add comma-separated table names.`);
      return [{ path: "schema.sql", contents: lines.join("\n") + "\n" }];
    }

    for (const t of tables) {
      const cols = columnsByTable[t];
      if (cols && cols.length > 0) {
        lines.push(...renderCreateTable(t, cols, dialect));
      } else {
        lines.push(...renderStubTable(t, plan, dialect));
      }
      lines.push(``);
    }

    // Render indexes from the `indexes` plan field. We can only guess
    // which column each index targets from the name (foo_idx → foo);
    // emit as ON-TODO blocks so designers correct them.
    const indexNames = (plan.indexes ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (indexNames.length > 0) {
      lines.push(`-- Indexes (from plan.indexes — verify the inferred column names below)`);
      for (const idx of indexNames) {
        const inferredCol = idx.replace(/_idx$|_index$/i, "");
        const inferredTable = tables[0]; // best-effort; can't know without structured input
        lines.push(
          `CREATE INDEX IF NOT EXISTS ${idx} ON ${inferredTable} (${inferredCol}); -- TODO: verify table/column`,
        );
      }
      lines.push(``);
    }

    return [{ path: "schema.sql", contents: lines.join("\n") + "\n" }];
  },
};

function parseTables(s: string): string[] {
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseColumnsYaml(s: string | undefined): Record<string, Column[]> {
  if (!s || !s.trim()) return {};
  try {
    const parsed = yaml.load(s);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, Column[]>;
  } catch (err) {
    // Bad YAML is a user error — surface it in the output rather than
    // crash the whole flesh-out run. We return {} so renderStubTable
    // kicks in for every table.
    console.warn(`Failed to parse plan.columns YAML: ${(err as Error).message}`);
    return {};
  }
}

function renderCreateTable(table: string, cols: Column[], dialect: Dialect): string[] {
  const lines: string[] = [];
  lines.push(`CREATE TABLE IF NOT EXISTS ${table} (`);

  const colLines = cols.map((c) => {
    const parts: string[] = [`  ${c.name} ${renderType(c.type, dialect)}`];
    if (c.primary) parts.push("PRIMARY KEY");
    if (c.unique && !c.primary) parts.push("UNIQUE");
    if (c.nullable === false) parts.push("NOT NULL");
    if (c.default !== undefined) parts.push(`DEFAULT ${c.default}`);
    if (c.references) parts.push(`REFERENCES ${c.references}`);
    return parts.join(" ");
  });

  // Composite PK: if multiple `primary: true` columns, emit a table-level
  // constraint and drop the per-column PRIMARY KEY clauses.
  const primaries = cols.filter((c) => c.primary).map((c) => c.name);
  if (primaries.length > 1) {
    const trimmed = colLines.map((l) => l.replace(/\s+PRIMARY KEY/, ""));
    lines.push(trimmed.join(",\n") + ",");
    lines.push(`  PRIMARY KEY (${primaries.join(", ")})`);
  } else {
    lines.push(colLines.join(",\n"));
  }

  lines.push(`);`);
  return lines;
}

function renderType(t: string, dialect: Dialect): string {
  const lower = t.toLowerCase();
  // Tiny dialect remap for the most common surprises.
  if (lower === "uuid" && dialect === "mysql") return "CHAR(36)";
  if (lower === "uuid" && dialect === "sqlite") return "TEXT";
  if (lower === "timestamptz" && dialect === "mysql") return "TIMESTAMP";
  if (lower === "timestamptz" && dialect === "sqlite") return "TEXT";
  if (lower === "jsonb" && dialect === "mysql") return "JSON";
  if (lower === "jsonb" && dialect === "sqlite") return "TEXT";
  if (lower === "serial" && dialect === "mysql") return "INT AUTO_INCREMENT";
  if (lower === "serial" && dialect === "sqlite") return "INTEGER";
  return t;
}

function renderStubTable(
  table: string,
  plan: Record<string, string>,
  dialect: Dialect,
): string[] {
  const lines: string[] = [];
  lines.push(`-- TODO: populate plan.columns for "${table}" to generate real DDL.`);
  lines.push(`-- Expected YAML shape under plan.columns:`);
  lines.push(`--   ${table}:`);
  lines.push(`--     - { name: id, type: uuid, primary: true }`);
  lines.push(`--     - { name: ..., type: ..., nullable: false }`);
  lines.push(`CREATE TABLE IF NOT EXISTS ${table} (`);
  lines.push(`  -- inferred from plan.primaryKey="${plan.primaryKey ?? ""}"`);
  lines.push(`  ${stubPrimary(plan.primaryKey ?? "id", dialect)}`);
  if (plan.sortKey) {
    lines.push(`  , ${plan.sortKey} ${dialect === "postgres" ? "TIMESTAMPTZ" : "TIMESTAMP"} NOT NULL`);
  }
  lines.push(`);`);
  return lines;
}

function stubPrimary(rawPk: string, dialect: Dialect): string {
  // Accept shapes like "id (UUID)", "id", "user_id (BIGINT)".
  const m = rawPk.match(/^(\w+)\s*(?:\(([^)]+)\))?/);
  const name = m?.[1] ?? "id";
  const type = renderType(m?.[2] ?? "uuid", dialect);
  return `${name} ${type} PRIMARY KEY`;
}
