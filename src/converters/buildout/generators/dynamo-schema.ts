/**
 * Deterministic DynamoDB schema generator.
 *
 * Reads a `database` node with technology=dynamodb and emits
 * `dynamo-table.json` — a CloudFormation-compatible AWS::DynamoDB::Table
 * resource (just the `Properties` block). CFN's shape is also what the
 * CDK and AWS SDK CreateTable accept, so it's the most universal format.
 *
 * Input shape (plan.accessPatterns YAML):
 *   - name: "Get user by id"
 *     partition: "USER#<userId>"        # required; literal or templated
 *     sort: "PROFILE"                   # optional
 *     projection: "all"                 # optional: all | keys_only | include
 *
 * Algorithm (v1, intentionally simple):
 *   1. The FIRST access pattern's keys define the BASE table (PK + optional SK).
 *   2. Every subsequent pattern that uses a DIFFERENT partition attribute
 *      becomes a GSI. Patterns that reuse the base PK are assumed to be
 *      satisfied by the base table's SK queries.
 *   3. Attribute types default to S (string). Override via attributes hint.
 *
 * TODO(v2): consider patterns more deeply — sparse GSIs from filter
 * fields, LSI vs GSI choice, projection optimization. Today we choose
 * GSI with projection=ALL (the safest default for OLTP).
 *
 * Why CloudFormation: the design canvas already supports CFN exports,
 * and the same JSON works for CDK / Terraform `aws_dynamodb_table` /
 * SDK CreateTable with minor reshaping. Single source of truth.
 */

import yaml from "js-yaml";
import type { Generator, GeneratorContext, GeneratedFile } from "../types";

interface AccessPattern {
  name: string;
  partition: string;
  sort?: string;
  projection?: "all" | "keys_only" | "include";
}

export const dynamoSchemaGenerator: Generator = {
  kind: "deterministic",

  supports(ctx) {
    return (
      ctx.node.componentType === "database" && ctx.node.plan?.technology === "dynamodb"
    );
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    const plan = ctx.node.plan ?? {};
    const tableName = (plan.tables?.split(",")[0]?.trim() || ctx.node.label || "Table").replace(
      /\s+/g,
      "",
    );

    const patterns = parseAccessPatterns(plan.accessPatterns);
    if (patterns.length === 0) {
      return [
        {
          path: "dynamo-table.json",
          contents: stubTable(tableName, plan),
        },
      ];
    }

    const base = patterns[0];
    const basePk = attrFromTemplate(base.partition, "PK");
    const baseSk = base.sort ? attrFromTemplate(base.sort, "SK") : undefined;

    // Track attribute names → type so we declare AttributeDefinitions once.
    const attrs = new Map<string, string>();
    attrs.set(basePk.name, basePk.type);
    if (baseSk) attrs.set(baseSk.name, baseSk.type);

    interface GSI {
      indexName: string;
      pk: { name: string; type: string };
      sk?: { name: string; type: string };
      projection: "all" | "keys_only";
    }
    const gsis: GSI[] = [];

    // Index satisfying each pattern, by pattern position. patterns[0] is
    // the base table; subsequent patterns are either a new GSI or a
    // refinement of the base SK query (when they reuse the base PK). We
    // track this per-pattern so the access-pattern doc stays aligned even
    // when some patterns don't produce a GSI.
    const indexLabelByPattern: string[] = ["base"];

    for (let i = 1; i < patterns.length; i++) {
      const p = patterns[i];
      const pk = attrFromTemplate(p.partition, `GSI${i}PK`);
      // If the partition reuses the base attribute, no new index needed —
      // it's a refinement of the base SK query.
      if (pk.name === basePk.name) {
        indexLabelByPattern.push("base");
        continue;
      }

      const sk = p.sort ? attrFromTemplate(p.sort, `GSI${i}SK`) : undefined;
      const projection = p.projection === "keys_only" ? "keys_only" : "all";

      attrs.set(pk.name, pk.type);
      if (sk) attrs.set(sk.name, sk.type);

      const indexName = slugifyIndexName(p.name) || `GSI${i}`;
      indexLabelByPattern.push(indexName);
      gsis.push({
        indexName,
        pk,
        sk,
        projection,
      });
    }

    const cfn = {
      Type: "AWS::DynamoDB::Table",
      Properties: {
        TableName: tableName,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [...attrs.entries()].map(([name, type]) => ({
          AttributeName: name,
          AttributeType: type,
        })),
        KeySchema: [
          { AttributeName: basePk.name, KeyType: "HASH" },
          ...(baseSk ? [{ AttributeName: baseSk.name, KeyType: "RANGE" }] : []),
        ],
        ...(gsis.length > 0
          ? {
              GlobalSecondaryIndexes: gsis.map((g) => ({
                IndexName: g.indexName,
                KeySchema: [
                  { AttributeName: g.pk.name, KeyType: "HASH" },
                  ...(g.sk ? [{ AttributeName: g.sk.name, KeyType: "RANGE" }] : []),
                ],
                Projection: {
                  ProjectionType: g.projection === "all" ? "ALL" : "KEYS_ONLY",
                },
              })),
            }
          : {}),
      },
    };

    // Sidecar: human-readable access pattern map so the next reader
    // can verify what GSI satisfies what query.
    const accessMap = [
      "# Access patterns covered by this table",
      "",
      `## Base table key`,
      `- PK: \`${basePk.name}\` ← ${base.partition}`,
      ...(baseSk ? [`- SK: \`${baseSk.name}\` ← ${base.sort}`] : []),
      "",
      "## Queries",
      ...patterns.map((p, i) => `- [${indexLabelByPattern[i]}] ${p.name}`),
    ].join("\n");

    return [
      {
        path: "dynamo-table.json",
        contents: JSON.stringify(cfn, null, 2) + "\n",
      },
      {
        path: "access-patterns.md",
        contents: accessMap + "\n",
      },
    ];
  },
};

function parseAccessPatterns(s: string | undefined): AccessPattern[] {
  if (!s || !s.trim()) return [];
  try {
    const parsed = yaml.load(s);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is AccessPattern =>
        typeof p === "object" && p !== null && typeof p.partition === "string",
    );
  } catch (err) {
    console.warn(`Failed to parse plan.accessPatterns YAML: ${(err as Error).message}`);
    return [];
  }
}

/**
 * From a template like "USER#<userId>" extract the attribute name we use
 * to address it. Heuristic: if the template contains a literal prefix
 * before the first `<placeholder>`, name the attribute after the prefix
 * (uppercased). Else fall back to the supplied default.
 *
 * Type is S (string) by default. Numeric/Binary support deferred — most
 * single-table-design schemas use string keys regardless.
 */
function attrFromTemplate(
  template: string,
  fallback: string,
): { name: string; type: "S" | "N" | "B" } {
  const prefixMatch = template.match(/^([A-Za-z][A-Za-z0-9_]*)[#<]/);
  if (prefixMatch) {
    return { name: prefixMatch[1] + "_id", type: "S" };
  }
  // Bare attribute name like "createdAt" stays as-is.
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(template.trim())) {
    return { name: template.trim(), type: "S" };
  }
  return { name: fallback, type: "S" };
}

function slugifyIndexName(name: string): string {
  return name
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function stubTable(tableName: string, plan: Record<string, string>): string {
  const stub = {
    Type: "AWS::DynamoDB::Table",
    Properties: {
      TableName: tableName,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
    },
    _todo: [
      "Populate plan.accessPatterns as YAML to derive real PK/SK/GSI:",
      "- name: <query name>",
      "  partition: <template e.g. USER#<userId>>",
      "  sort: <optional template>",
      `Existing plan: primaryKey="${plan.primaryKey ?? ""}" sortKey="${plan.sortKey ?? ""}"`,
    ],
  };
  return JSON.stringify(stub, null, 2) + "\n";
}
