/**
 * Data-warehouse schema generator.
 *
 * Tech-aware DDL dialects:
 *   - bigquery → `CREATE TABLE ... PARTITION BY ... CLUSTER BY ...`
 *   - snowflake → `CREATE TABLE ... CLUSTER BY ...`
 *   - redshift → `CREATE TABLE ... DISTKEY / SORTKEY`
 *   - default → PostgreSQL-ish DDL
 *
 * Uses the same plan.columns YAML shape as the SQL generator for table
 * definitions. plan.partitioning hints follow free-form English; we do a
 * best-effort parse for date partitioning ("By date, monthly").
 */

import yaml from "js-yaml";
import type { Generator, GeneratorContext, GeneratedFile } from "../types";

interface Column {
  name: string;
  type: string;
  nullable?: boolean;
}

export const warehouseSchemaGenerator: Generator = {
  kind: "deterministic",
  supports: (ctx) => ctx.node.componentType === "data-warehouse",
  async generate(ctx): Promise<GeneratedFile[]> {
    const p = ctx.node.plan ?? {};
    const tech = (p.technology || "").toLowerCase();
    const tables = (p.tables || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const partHint = (p.partitioning || "").toLowerCase();
    const colsByTable = parseColumnsYaml(p.columns);

    if (tables.length === 0) {
      return [
        {
          path: "schema.sql",
          contents: `-- No tables declared in plan.tables.\n`,
        },
      ];
    }

    const lines: string[] = [];
    lines.push(`-- ${ctx.node.label} — warehouse DDL (${tech || "ansi"})`);
    lines.push(``);
    for (const t of tables) {
      const cols = colsByTable[t] ?? [];
      lines.push(...renderTable(t, cols, tech, partHint));
      lines.push(``);
    }

    return [{ path: "schema.sql", contents: lines.join("\n") + "\n" }];
  },
};

function parseColumnsYaml(s: string | undefined): Record<string, Column[]> {
  if (!s) return {};
  try {
    const p = yaml.load(s);
    return (p && typeof p === "object" ? p : {}) as Record<string, Column[]>;
  } catch {
    return {};
  }
}

function renderTable(name: string, cols: Column[], tech: string, partHint: string): string[] {
  const lines: string[] = [];
  lines.push(`CREATE TABLE IF NOT EXISTS ${name} (`);
  if (cols.length === 0) {
    lines.push(`  -- TODO: populate plan.columns.${name}`);
    lines.push(`  id STRING NOT NULL`);
  } else {
    lines.push(
      cols
        .map((c) => `  ${c.name} ${c.type}${c.nullable === false ? " NOT NULL" : ""}`)
        .join(",\n"),
    );
  }
  lines.push(`)`);

  const partitionCol = cols.find((c) => /timestamp|date|datetime/i.test(c.type))?.name;
  if (tech.includes("bigquery") && partHint.includes("date") && partitionCol) {
    lines.push(
      `PARTITION BY DATE_TRUNC(${partitionCol}, ${partHint.includes("month") ? "MONTH" : "DAY"})`,
    );
  } else if (tech.includes("snowflake") && partitionCol) {
    lines.push(`CLUSTER BY (${partitionCol})`);
  } else if (tech.includes("redshift") && partitionCol) {
    lines.push(`DISTSTYLE KEY DISTKEY(${partitionCol}) SORTKEY(${partitionCol})`);
  } else if (partHint && !partitionCol) {
    lines.push(`-- TODO: partitioning hint "${partHint}" but no date/timestamp column declared`);
  }
  lines.push(`;`);
  return lines;
}
