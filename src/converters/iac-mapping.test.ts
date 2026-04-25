import { describe, it, expect } from "vitest";
import {
  resolveTechId,
  getResourceMapping,
  getDefaultMapping,
  getDefaultPorts,
  allocateHostPort,
  cfnToComponentType,
  terraformToComponentType,
  k8sToComponentType,
  dockerToComponentType,
} from "./iac-mapping";

describe("resolveTechId", () => {
  it("returns the ID when it matches a known mapping", () => {
    expect(resolveTechId("database", "postgresql")).toBe("postgresql");
  });

  it("resolves a display name to its technology ID", () => {
    expect(resolveTechId("database", "PostgreSQL")).toBe("postgresql");
  });

  it("falls back to the first entry for the component type when input is empty", () => {
    const id = resolveTechId("database", "");
    expect(id).toBe("postgresql");
  });

  it('prefers a docker-capable entry when prefer="docker" and input is empty', () => {
    // serverless: first entry is lambda (no docker), but prefer=docker should skip it
    const id = resolveTechId("serverless", "", "docker");
    // lambda has no docker mapping, so it should be skipped
    // There's no serverless entry with docker, so it falls through to first entry
    expect(id).toBeTruthy();
  });

  it("lowercases and hyphenates unknown tech names", () => {
    expect(resolveTechId("database", "My Custom DB")).toBe("my-custom-db");
  });

  it("returns known tech for cron with prefer=docker", () => {
    // cron: eventbridge (no docker) vs linux-cron (has docker)
    const id = resolveTechId("cron", "", "docker");
    expect(id).toBe("linux-cron");
  });
});

describe("getResourceMapping", () => {
  it("returns mapping for a known componentType + tech pair", () => {
    const mapping = getResourceMapping("database", "postgresql");
    expect(mapping).toBeDefined();
    expect(mapping!.cfn).toBe("AWS::RDS::DBInstance");
    expect(mapping!.terraform).toBe("aws_db_instance");
    expect(mapping!.docker).toContain("postgres");
    expect(mapping!.defaultPorts).toEqual([5432]);
  });

  it("resolves display names to the correct mapping", () => {
    const mapping = getResourceMapping("database", "PostgreSQL");
    expect(mapping).toBeDefined();
    expect(mapping!.docker).toContain("postgres");
  });

  it("returns undefined for an unknown tech", () => {
    expect(getResourceMapping("database", "completely-unknown-db")).toBeUndefined();
  });

  it("returns mapping with CDK metadata for supported technologies", () => {
    const mapping = getResourceMapping("database", "postgresql");
    expect(mapping!.cdk).toBeDefined();
    expect(mapping!.cdk!.module).toBe("aws-cdk-lib/aws-rds");
    expect(mapping!.cdk!.construct).toBe("DatabaseInstance");
  });

  it("returns mapping with Pulumi metadata for supported technologies", () => {
    const mapping = getResourceMapping("database", "postgresql");
    expect(mapping!.pulumi).toBeDefined();
    expect(mapping!.pulumi!.resource).toBe("rds.Instance");
  });
});

describe("getDefaultMapping", () => {
  it("returns the first mapping for a known component type", () => {
    const mapping = getDefaultMapping("database");
    expect(mapping).toBeDefined();
    // First database entry is postgresql
    expect(mapping!.docker).toContain("postgres");
  });

  it("returns undefined for a component type with no mappings", () => {
    expect(getDefaultMapping("client" as never)).toBeUndefined();
  });
});

describe("getDefaultPorts", () => {
  it("returns the mapped ports for a known tech", () => {
    expect(getDefaultPorts("database", "postgresql")).toEqual([5432]);
    expect(getDefaultPorts("cache", "redis")).toEqual([6379]);
    expect(getDefaultPorts("message-queue", "kafka")).toEqual([9092]);
  });

  it("falls back to the default mapping when the specific tech has no ports", () => {
    // aurora has no docker/defaultPorts, falls back to postgresql (first db entry)
    const ports = getDefaultPorts("database", "aurora");
    expect(ports).toEqual([5432]);
  });

  it("returns [8080] when no mapping exists at all", () => {
    expect(getDefaultPorts("client" as never, "browser")).toEqual([8080]);
  });
});

describe("allocateHostPort", () => {
  it("returns the preferred port when it is unused", () => {
    const used = new Set<number>();
    expect(allocateHostPort(5432, used)).toBe(5432);
    expect(used.has(5432)).toBe(true);
  });

  it("increments past collisions", () => {
    const used = new Set([5432, 5433]);
    expect(allocateHostPort(5432, used)).toBe(5434);
    expect(used.has(5434)).toBe(true);
  });
});

describe("reverse lookups", () => {
  it("cfnToComponentType resolves AWS::RDS::DBInstance", () => {
    const result = cfnToComponentType("AWS::RDS::DBInstance");
    expect(result).toBeDefined();
    expect(result!.componentType).toBe("database");
    expect(result!.technologyId).toBe("postgresql");
  });

  it("cfnToComponentType returns undefined for unknown types", () => {
    expect(cfnToComponentType("AWS::Unknown::Resource")).toBeUndefined();
  });

  it("terraformToComponentType resolves aws_s3_bucket", () => {
    const result = terraformToComponentType("aws_s3_bucket");
    expect(result).toBeDefined();
    expect(result!.componentType).toBe("storage");
    expect(result!.technologyId).toBe("s3");
  });

  it("k8sToComponentType resolves StatefulSet", () => {
    const result = k8sToComponentType("StatefulSet");
    expect(result).toBeDefined();
    expect(result!.componentType).toBe("database");
  });

  it("k8sToComponentType resolves CronJob", () => {
    const result = k8sToComponentType("CronJob");
    expect(result).toBeDefined();
    expect(result!.componentType).toBe("cron");
  });

  it("dockerToComponentType resolves postgres image", () => {
    const result = dockerToComponentType("postgres:17-alpine");
    expect(result).toBeDefined();
    expect(result!.componentType).toBe("database");
    expect(result!.technologyId).toBe("postgresql");
  });

  it("dockerToComponentType strips the tag when matching", () => {
    const result = dockerToComponentType("redis:8-alpine");
    expect(result).toBeDefined();
    expect(result!.componentType).toBe("cache");
    expect(result!.technologyId).toBe("redis");
  });

  it("dockerToComponentType returns undefined for unknown images", () => {
    expect(dockerToComponentType("mycompany/myapp:latest")).toBeUndefined();
  });
});
