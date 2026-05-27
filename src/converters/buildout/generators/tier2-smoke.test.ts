/**
 * Smoke tests for the remaining Tier 2 (deterministic) generators.
 *
 * Each generator gets one "happy path" assertion and one "no input"
 * assertion to make sure the stub-fallback works. Full coverage lives
 * in dedicated test files for sql-schema, dynamo-schema, and openapi.
 */

import { describe, expect, it } from "vitest";
import type { ComponentType } from "../../../types";
import type { GeneratorContext } from "../types";
import { cacheConfigGenerator } from "./cache-config";
import { queueConfigGenerator } from "./queue-config";
import { searchMappingGenerator } from "./search-mapping";
import { storageConfigGenerator } from "./storage-config";
import { lbConfigGenerator } from "./lb-config";
import { firewallConfigGenerator } from "./firewall-config";
import { dnsConfigGenerator } from "./dns-config";
import { cdnConfigGenerator } from "./cdn-config";
import { k8sManifestGenerator } from "./k8s-manifests";
import { warehouseSchemaGenerator } from "./warehouse-schema";

function ctx(
  componentType: ComponentType,
  plan: Record<string, string> = {},
  extra: Partial<GeneratorContext> = {},
): GeneratorContext {
  return {
    node: {
      id: "n1",
      label: "Test Node",
      description: "",
      componentType,
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
    ...extra,
  };
}

describe("cache generator", () => {
  it("emits README + redis.conf", async () => {
    const files = await cacheConfigGenerator.generate(
      ctx("cache", { technology: "redis", ttl: "120s", eviction: "allkeys-lfu", maxSize: "1gb" }),
    );
    expect(files.map((f) => f.path).sort()).toEqual(["README.md", "redis.conf"]);
    expect(files.find((f) => f.path === "redis.conf")!.contents).toContain("maxmemory 1gb");
    expect(files.find((f) => f.path === "redis.conf")!.contents).toContain("allkeys-lfu");
  });
});

describe("queue generator", () => {
  it("emits Kafka topic JSON when tech=kafka", async () => {
    const files = await queueConfigGenerator.generate(
      ctx("message-queue", {
        technology: "kafka",
        topics: "user.created, order.placed",
        partitions: "6",
        retention: "3d",
      }),
    );
    expect(files[0].path).toBe("topics.json");
    const parsed = JSON.parse(files[0].contents);
    expect(parsed.topics).toHaveLength(2);
    expect(parsed.topics[0].partitions).toBe(6);
  });

  it("emits SQS CFN when tech=sqs", async () => {
    const files = await queueConfigGenerator.generate(
      ctx("message-queue", { technology: "sqs", topics: "orders" }),
    );
    expect(files[0].path).toBe("queues.cfn.json");
    const parsed = JSON.parse(files[0].contents);
    expect(parsed.Resources.ordersDLQ.Type).toBe("AWS::SQS::Queue");
    expect(parsed.Resources.orders.Properties.RedrivePolicy).toBeTruthy();
  });

  it("falls back to topics.md for unrecognized tech", async () => {
    const files = await queueConfigGenerator.generate(
      ctx("message-queue", { technology: "nats", topics: "a, b" }),
    );
    expect(files[0].path).toBe("topics.md");
  });
});

describe("search-engine generator", () => {
  it("emits ES-shaped mapping JSON", async () => {
    const files = await searchMappingGenerator.generate(
      ctx("search-engine", {
        technology: "elasticsearch",
        indexName: "products",
        mappings: "fields:\n  title: { type: text }\n  price: { type: float }",
      }),
    );
    expect(files[0].path).toBe("products.mapping.json");
    const parsed = JSON.parse(files[0].contents);
    expect(parsed.mappings.properties.title.type).toBe("text");
  });
});

describe("storage generator", () => {
  it("emits S3 CFN for S3 tech", async () => {
    const files = await storageConfigGenerator.generate(
      ctx("storage", {
        technology: "s3",
        bucketName: "my-bucket",
        encryption: "AES-256",
        lifecycle: "Archive after 90d",
      }),
    );
    const parsed = JSON.parse(files[0].contents);
    expect(parsed.Resources.Bucket.Type).toBe("AWS::S3::Bucket");
    expect(parsed.Resources.Bucket.Properties.LifecycleConfiguration.Rules[0].Transitions[0].TransitionInDays).toBe(90);
  });
});

describe("lb generator", () => {
  it("emits ALB CFN + nginx upstream", async () => {
    const files = await lbConfigGenerator.generate(
      ctx("load-balancer", {
        algorithm: "least connections",
        targets: "svc-a, svc-b",
        protocol: "HTTPS",
        healthCheck: "/health, 10s interval",
      }),
    );
    expect(files.map((f) => f.path).sort()).toEqual(["lb.cfn.json", "nginx.conf"]);
    expect(files.find((f) => f.path === "nginx.conf")!.contents).toContain("least_conn");
    expect(files.find((f) => f.path === "nginx.conf")!.contents).toContain("svc-a");
  });
});

describe("firewall generator", () => {
  it("renders ingress rules with allowedIPs", async () => {
    const files = await firewallConfigGenerator.generate(
      ctx("firewall", {
        inboundRules: "443/tcp, 80/tcp",
        allowedIPs: "10.0.0.0/8",
      }),
    );
    const cfn = JSON.parse(files.find((f) => f.path === "security-group.cfn.json")!.contents);
    expect(cfn.Resources.SecurityGroup.Properties.SecurityGroupIngress).toHaveLength(2);
    expect(cfn.Resources.SecurityGroup.Properties.SecurityGroupIngress[0].FromPort).toBe(443);
    expect(cfn.Resources.SecurityGroup.Properties.SecurityGroupIngress[0].CidrIp).toBe("10.0.0.0/8");
  });
});

describe("dns generator", () => {
  it("emits Route53 CFN + zone file", async () => {
    const files = await dnsConfigGenerator.generate(
      ctx("dns", { domain: "api.example.com.", recordTypes: "A, AAAA", ttl: "60s" }),
    );
    expect(files.map((f) => f.path).sort()).toEqual(["route53.cfn.json", "zone.txt"]);
    const cfn = JSON.parse(files.find((f) => f.path === "route53.cfn.json")!.contents);
    expect(cfn.Resources.Records.Properties.RecordSets).toHaveLength(2);
    expect(cfn.Resources.Records.Properties.RecordSets[0].TTL).toBe(60);
  });
});

describe("cdn generator", () => {
  it("emits CloudFront with origins and cache behaviors", async () => {
    const files = await cdnConfigGenerator.generate(
      ctx("cdn", {
        origins: "api.example.com, static.example.com",
        cacheRules: "static/* 30d",
        edgeLocations: "Global",
      }),
    );
    const cfn = JSON.parse(files[0].contents);
    expect(cfn.Resources.Distribution.Properties.DistributionConfig.Origins).toHaveLength(2);
    expect(cfn.Resources.Distribution.Properties.DistributionConfig.PriceClass).toBe("PriceClass_All");
    expect(cfn.Resources.Distribution.Properties.DistributionConfig.CacheBehaviors[0].DefaultTTL).toBe(30 * 86400);
  });
});

describe("k8s generator", () => {
  it("emits namespace + per-service Deployment/Service/HPA", async () => {
    const files = await k8sManifestGenerator.generate(
      ctx(
        "container-orchestration",
        { clusterSize: "5 nodes", namespace: "production", resources: "2 vCPU, 4 Gi per pod" },
        {
          outbound: [
            {
              otherNodeId: "s1",
              otherNodeLabel: "Orders Service",
              otherComponentType: "service",
              otherTechId: "nodejs",
            },
          ],
        },
      ),
    );
    expect(files.find((f) => f.path === "namespace.yaml")).toBeTruthy();
    const svc = files.find((f) => f.path === "orders-service.yaml")!;
    expect(svc.contents).toContain("kind: Deployment");
    expect(svc.contents).toContain("kind: Service");
    expect(svc.contents).toContain("kind: HorizontalPodAutoscaler");
    expect(svc.contents).toContain("namespace: production");
  });
});

describe("warehouse generator", () => {
  it("emits BigQuery-style partitioned DDL", async () => {
    const cols = `
fact_orders:
  - { name: order_id, type: STRING, nullable: false }
  - { name: created_at, type: TIMESTAMP, nullable: false }
`.trim();
    const files = await warehouseSchemaGenerator.generate(
      ctx("data-warehouse", {
        technology: "bigquery",
        tables: "fact_orders",
        partitioning: "By date, monthly",
        columns: cols,
      }),
    );
    expect(files[0].contents).toContain("PARTITION BY DATE_TRUNC(created_at, MONTH)");
  });
});
