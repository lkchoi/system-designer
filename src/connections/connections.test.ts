import { describe, it, expect } from "vitest";
import {
  resolveConnection,
  validateTechConnection,
  getRecommendedTargets,
  getIaCMetadata,
  getEnvVarTemplate,
  getComponentDefault,
  getTechRule,
} from "./index";
import { COMPONENT_RULES } from "./component-rules";
import { TECH_RULES } from "./tech-rules";
import { BUILTIN_ENTRIES } from "../registry/builtin-entries";

describe("getComponentDefault", () => {
  it("returns rule for a known pair", () => {
    const rule = getComponentDefault("service", "database");
    expect(rule).toBeDefined();
    expect(rule!.protocol).toBe("TCP");
    expect(rule!.format).toBe("JSON");
    expect(rule!.label).toBe("queries");
    expect(rule!.commonality).toBe(0.95);
  });

  it("returns undefined for an unknown pair", () => {
    expect(getComponentDefault("database", "client")).toBeUndefined();
  });
});

describe("getTechRule", () => {
  it("returns wildcard rule for a known target tech", () => {
    const rule = getTechRule("nodejs", "postgresql");
    expect(rule).toBeDefined();
    expect(rule!.port).toBe(5432);
    expect(rule!.envVars).toHaveProperty("DATABASE_URL");
  });

  it("returns specific rule over wildcard", () => {
    const rule = getTechRule("cf-workers", "postgresql");
    expect(rule).toBeDefined();
    expect(rule!.allowed).toBe(false);
  });

  it("returns undefined for unknown tech pair", () => {
    expect(getTechRule("nodejs", "nonexistent-tech")).toBeUndefined();
  });
});

describe("resolveConnection", () => {
  it("merges component defaults with tech overrides", () => {
    const resolved = resolveConnection("service", "nodejs", "database", "postgresql");
    expect(resolved).toBeDefined();
    expect(resolved!.protocol).toBe("TCP");
    expect(resolved!.format).toBe("JSON");
    expect(resolved!.label).toBe("queries");
    expect(resolved!.allowed).toBe(true);
    expect(resolved!.envVars).toHaveProperty("DATABASE_URL");
    expect(resolved!.envVars!.DATABASE_URL).toContain("{HOST}");
    expect(resolved!.iac?.iamActions).toContain("rds-db:connect");
    expect(resolved!.iac?.cdkGrant).toBe("grantConnect");
  });

  it("tech protocol overrides component default", () => {
    const resolved = resolveConnection("service", "nodejs", "database", "dynamodb");
    expect(resolved).toBeDefined();
    expect(resolved!.protocol).toBe("HTTPS");
    expect(resolved!.format).toBe("JSON");
  });

  it("returns blocked for cf-workers → postgresql", () => {
    const resolved = resolveConnection("serverless", "cf-workers", "database", "postgresql");
    expect(resolved).toBeDefined();
    expect(resolved!.allowed).toBe(false);
    expect(resolved!.blockedReason).toContain("TCP socket");
  });

  it("returns undefined for pair with no component rule", () => {
    expect(resolveConnection("database", "postgresql", "client", "react")).toBeUndefined();
  });

  it("works with empty tech strings (falls back to component defaults)", () => {
    const resolved = resolveConnection("service", "", "database", "");
    expect(resolved).toBeDefined();
    expect(resolved!.protocol).toBe("TCP");
    expect(resolved!.allowed).toBe(true);
    expect(resolved!.envVars).toBeUndefined();
  });

  it("serverless → storage defaults to HTTPS", () => {
    const resolved = resolveConnection("serverless", "lambda", "storage", "s3");
    expect(resolved).toBeDefined();
    expect(resolved!.protocol).toBe("HTTPS");
    expect(resolved!.iac?.iamActions).toContain("s3:GetObject");
    expect(resolved!.iac?.cdkGrant).toBe("grantReadWrite");
  });
});

describe("validateTechConnection", () => {
  it("returns allowed for normal pairs", () => {
    expect(validateTechConnection("nodejs", "postgresql")).toEqual({ allowed: true });
  });

  it("returns blocked for cf-workers → redis", () => {
    const result = validateTechConnection("cf-workers", "redis");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Upstash");
  });

  it("returns allowed for unknown pairs (no restriction)", () => {
    expect(validateTechConnection("nodejs", "unknown-db")).toEqual({ allowed: true });
  });
});

describe("getRecommendedTargets", () => {
  it("returns targets sorted by commonality", () => {
    const targets = getRecommendedTargets("service");
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0].target).toBe("database");
    expect(targets[0].commonality).toBe(0.95);
    for (let i = 1; i < targets.length; i++) {
      expect(targets[i].commonality).toBeLessThanOrEqual(targets[i - 1].commonality);
    }
  });

  it("filters by existing types", () => {
    const targets = getRecommendedTargets("service", ["database", "cache"]);
    expect(targets.every((t) => t.target === "database" || t.target === "cache")).toBe(true);
  });

  it("returns empty for component with no outgoing rules", () => {
    const targets = getRecommendedTargets("data-warehouse");
    expect(targets).toHaveLength(0);
  });

  it("returns results for client", () => {
    const targets = getRecommendedTargets("client");
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0].target).toBe("api-gateway");
  });
});

describe("getIaCMetadata", () => {
  it("returns IAM actions for dynamodb", () => {
    const iac = getIaCMetadata("lambda", "dynamodb");
    expect(iac).toBeDefined();
    expect(iac!.iamActions).toContain("dynamodb:GetItem");
    expect(iac!.iamActions).toContain("dynamodb:PutItem");
    expect(iac!.cdkGrant).toBe("grantReadWriteData");
  });

  it("returns security group ports for postgresql", () => {
    const iac = getIaCMetadata("nodejs", "postgresql");
    expect(iac).toBeDefined();
    expect(iac!.securityGroupPorts).toContainEqual({ port: 5432, protocol: "tcp" });
    expect(iac!.k8sPort).toBe(5432);
  });

  it("returns undefined for unknown pair", () => {
    expect(getIaCMetadata("nodejs", "unknown")).toBeUndefined();
  });

  it("returns IaC for SQS", () => {
    const iac = getIaCMetadata("lambda", "sqs");
    expect(iac).toBeDefined();
    expect(iac!.iamActions).toContain("sqs:SendMessage");
    expect(iac!.cdkGrant).toBe("grantSendMessages");
  });

  it("returns IaC for S3", () => {
    const iac = getIaCMetadata("nodejs", "s3");
    expect(iac).toBeDefined();
    expect(iac!.iamActions).toContain("s3:PutObject");
    expect(iac!.cdkGrant).toBe("grantReadWrite");
  });

  it("returns grant for api-gateway → lambda", () => {
    const iac = getIaCMetadata("aws-api-gateway", "lambda");
    expect(iac).toBeDefined();
    expect(iac!.iamActions).toContain("lambda:InvokeFunction");
    expect(iac!.cdkGrant).toBe("grantInvoke");
  });
});

describe("getEnvVarTemplate", () => {
  it("returns env vars for postgresql", () => {
    const env = getEnvVarTemplate("nodejs", "postgresql");
    expect(env).toBeDefined();
    expect(env!.DATABASE_URL).toBe("postgres://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB_NAME}");
    expect(env!.DB_HOST).toBe("{HOST}");
  });

  it("returns env vars for redis", () => {
    const env = getEnvVarTemplate("go", "redis");
    expect(env).toBeDefined();
    expect(env!.REDIS_URL).toBe("redis://{HOST}:{PORT}");
  });

  it("returns env vars for kafka", () => {
    const env = getEnvVarTemplate("nodejs", "kafka");
    expect(env).toBeDefined();
    expect(env!.KAFKA_BOOTSTRAP_SERVERS).toBe("{HOST}:{PORT}");
  });

  it("returns undefined for dynamodb (no connection string)", () => {
    const env = getEnvVarTemplate("lambda", "dynamodb");
    expect(env).toBeUndefined();
  });

  it("returns env vars for minio", () => {
    const env = getEnvVarTemplate("nodejs", "minio");
    expect(env).toBeDefined();
    expect(env!.S3_ENDPOINT).toBe("http://{HOST}:{PORT}");
    expect(env!.AWS_ENDPOINT_URL).toBe("http://{HOST}:{PORT}");
  });

  it("returns undefined for unknown pair", () => {
    expect(getEnvVarTemplate("nodejs", "nonexistent")).toBeUndefined();
  });
});

describe("data integrity", () => {
  it("all blocked pairs have a blockedReason", () => {
    const blocked = TECH_RULES.filter((r) => r.allowed === false);
    expect(blocked.length).toBeGreaterThan(0);
    for (const rule of blocked) {
      expect(rule.blockedReason).toBeTruthy();
    }
  });

  it("component rules have commonality between 0 and 1", () => {
    for (const rule of COMPONENT_RULES) {
      expect(rule.commonality).toBeGreaterThanOrEqual(0);
      expect(rule.commonality).toBeLessThanOrEqual(1);
    }
  });

  it("no duplicate component rules", () => {
    const keys = new Set<string>();
    for (const rule of COMPONENT_RULES) {
      const key = `${rule.source}:${rule.target}`;
      expect(keys.has(key), `Duplicate component rule: ${key}`).toBe(false);
      keys.add(key);
    }
  });

  it("every connectsTo pair in the registry has a matching component rule", () => {
    const ruleKeys = new Set(COMPONENT_RULES.map((r) => `${r.source}:${r.target}`));
    const missing: string[] = [];
    for (const entry of BUILTIN_ENTRIES) {
      for (const target of entry.connectsTo) {
        const key = `${entry.id}:${target}`;
        if (!ruleKeys.has(key)) missing.push(key);
      }
    }
    expect(
      missing,
      `connectsTo pairs missing from COMPONENT_RULES:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every component rule has a matching connectsTo entry in the registry", () => {
    const connectsToKeys = new Set<string>();
    for (const entry of BUILTIN_ENTRIES) {
      for (const target of entry.connectsTo) {
        connectsToKeys.add(`${entry.id}:${target}`);
      }
    }
    const orphaned: string[] = [];
    for (const rule of COMPONENT_RULES) {
      const key = `${rule.source}:${rule.target}`;
      if (!connectsToKeys.has(key)) orphaned.push(key);
    }
    expect(
      orphaned,
      `COMPONENT_RULES without matching connectsTo:\n  ${orphaned.join("\n  ")}`,
    ).toEqual([]);
  });
});
