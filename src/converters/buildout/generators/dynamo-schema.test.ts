import { describe, expect, it } from "vitest";
import { dynamoSchemaGenerator } from "./dynamo-schema";
import type { GeneratorContext } from "../types";

function ctx(plan: Record<string, string>): GeneratorContext {
  return {
    node: {
      id: "db1",
      label: "App",
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

describe("dynamoSchemaGenerator", () => {
  it("supports only DynamoDB", () => {
    expect(dynamoSchemaGenerator.supports(ctx({ technology: "dynamodb" }))).toBe(true);
    expect(dynamoSchemaGenerator.supports(ctx({ technology: "postgresql" }))).toBe(false);
  });

  it("emits a stub when accessPatterns missing", async () => {
    const files = await dynamoSchemaGenerator.generate(ctx({ technology: "dynamodb" }));
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("dynamo-table.json");
    const parsed = JSON.parse(files[0].contents);
    expect(parsed.Type).toBe("AWS::DynamoDB::Table");
    expect(parsed._todo).toBeTruthy();
  });

  it("derives base PK/SK from first access pattern", async () => {
    const accessPatterns = `
- name: Get user profile
  partition: "USER#<userId>"
  sort: "PROFILE"
`.trim();
    const files = await dynamoSchemaGenerator.generate(
      ctx({ technology: "dynamodb", tables: "AppTable", accessPatterns }),
    );
    expect(files).toHaveLength(2);
    const cfn = JSON.parse(files[0].contents);
    // "USER#<userId>" has a placeholder → USER_id; bare "PROFILE" stays as-is.
    expect(cfn.Properties.KeySchema).toEqual([
      { AttributeName: "USER_id", KeyType: "HASH" },
      { AttributeName: "PROFILE", KeyType: "RANGE" },
    ]);
  });

  it("creates a GSI when partition differs from base", async () => {
    const accessPatterns = `
- name: Get user profile
  partition: "USER#<userId>"
  sort: "PROFILE"
- name: List by email
  partition: "EMAIL#<email>"
`.trim();
    const files = await dynamoSchemaGenerator.generate(
      ctx({ technology: "dynamodb", accessPatterns }),
    );
    const cfn = JSON.parse(files[0].contents);
    expect(cfn.Properties.GlobalSecondaryIndexes).toHaveLength(1);
    expect(cfn.Properties.GlobalSecondaryIndexes[0].IndexName).toContain("List_by_email");
    expect(cfn.Properties.GlobalSecondaryIndexes[0].KeySchema[0].AttributeName).toBe("EMAIL_id");
  });

  it("skips GSI when partition reuses base PK", async () => {
    const accessPatterns = `
- name: Get user profile
  partition: "USER#<userId>"
  sort: "PROFILE"
- name: List user orders
  partition: "USER#<userId>"
  sort: "ORDER#"
`.trim();
    const files = await dynamoSchemaGenerator.generate(
      ctx({ technology: "dynamodb", accessPatterns }),
    );
    const cfn = JSON.parse(files[0].contents);
    expect(cfn.Properties.GlobalSecondaryIndexes).toBeUndefined();
  });

  it("emits a companion access-patterns.md", async () => {
    const accessPatterns = `
- name: Get user profile
  partition: "USER#<userId>"
`.trim();
    const files = await dynamoSchemaGenerator.generate(
      ctx({ technology: "dynamodb", accessPatterns }),
    );
    expect(files.find((f) => f.path === "access-patterns.md")).toBeTruthy();
  });
});
