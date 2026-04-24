import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { generateInitScripts } from "./init-scripts";

function makeNode(
  id: string,
  componentType: SystemNodeData["componentType"],
  overrides: Partial<SystemNodeData> = {},
): Node<SystemNodeData> {
  return {
    id,
    type: "system",
    position: { x: 0, y: 0 },
    data: {
      label: id,
      description: "",
      componentType,
      status: "healthy",
      metrics: { cpu: 0, memory: 0, requestsPerSec: 0, latency: 0 },
      plan: {},
      sharded: false,
      shardKey: "",
      endpoints: [],
      links: [],
      capClassification: "",
      stressFailure: "none",
      capacityPercent: 50,
      consumerRate: 0,
      ...overrides,
    },
  };
}

function design(
  nodes: Node<SystemNodeData>[],
  edges: { source: string; target: string }[] = [],
): DesignJSON {
  return {
    version: 1,
    name: "t",
    nodes: nodes as unknown as DesignJSON["nodes"],
    edges: edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
    })) as unknown as DesignJSON["edges"],
    viewport: { x: 0, y: 0, zoom: 1 },
    flowPaths: [],
  };
}

describe("generateInitScripts — minio", () => {
  it("emits create-buckets.sh and a sidecar when bucketName is set", () => {
    const node = makeNode("s", "storage", {
      plan: { technology: "Amazon S3", bucketName: "uploads, archive" },
    });
    const result = generateInitScripts(design([node]), new Map([["s", "assets"]]));

    const file = result.files.find((f) => f.path === "init/assets/create-buckets.sh");
    expect(file).toBeDefined();
    expect(String(file!.content)).toContain("mc mb --ignore-existing local/uploads");
    expect(String(file!.content)).toContain("mc mb --ignore-existing local/archive");

    const sidecar = result.sidecars.find((s) => s.name === "assets-init");
    expect(sidecar).toBeDefined();
    expect(sidecar!.image).toBe("minio/mc:latest");
    expect(sidecar!.dependsOn).toBe("assets");
    expect(sidecar!.command).toContain("mc mb --ignore-existing local/uploads");
    expect(sidecar!.environment!.MC_HOST_local).toContain("@assets:9000");
  });

  it("emits nothing when bucketName is empty", () => {
    const node = makeNode("s", "storage", { plan: { technology: "Amazon S3" } });
    const result = generateInitScripts(design([node]), new Map([["s", "assets"]]));
    expect(result.files.find((f) => f.path.includes("create-buckets"))).toBeUndefined();
    expect(result.sidecars).toEqual([]);
  });

  it("strips s3:// prefixes from bucket names", () => {
    const node = makeNode("s", "storage", {
      plan: { technology: "Amazon S3", bucketName: "s3://my-bucket/path" },
    });
    const result = generateInitScripts(design([node]), new Map([["s", "assets"]]));
    const sidecar = result.sidecars[0];
    expect(sidecar.command).toContain("mc mb --ignore-existing local/my-bucket");
    expect(sidecar.command).not.toContain("s3://");
  });
});

describe("generateInitScripts — kafka", () => {
  it("emits create-topics.sh and a sidecar with kafka-topics calls", () => {
    const node = makeNode("k", "message-queue", {
      plan: {
        technology: "Apache Kafka",
        topics: "user.created, order.placed",
        partitions: "3",
      },
    });
    const result = generateInitScripts(design([node]), new Map([["k", "events"]]));

    const file = result.files.find((f) => f.path === "init/events/create-topics.sh");
    expect(file).toBeDefined();
    expect(String(file!.content)).toContain("--topic user.created --partitions 3");
    expect(String(file!.content)).toContain("--topic order.placed --partitions 3");

    const sidecar = result.sidecars.find((s) => s.name === "events-init");
    expect(sidecar).toBeDefined();
    expect(sidecar!.image).toContain("cp-kafka");
    expect(sidecar!.command).toContain("--bootstrap-server events:9092");
  });

  it("defaults partitions to 1 when not declared", () => {
    const node = makeNode("k", "message-queue", {
      plan: { technology: "Apache Kafka", topics: "events" },
    });
    const result = generateInitScripts(design([node]), new Map([["k", "events"]]));
    expect(result.sidecars[0].command).toContain("--partitions 1");
  });

  it("emits nothing for non-kafka queues even with topics declared", () => {
    const node = makeNode("k", "message-queue", {
      plan: { technology: "RabbitMQ", topics: "events" },
    });
    const result = generateInitScripts(design([node]), new Map([["k", "broker"]]));
    expect(result.sidecars).toEqual([]);
  });
});

describe("generateInitScripts — elasticsearch", () => {
  it("emits create-indexes.sh and a curl sidecar", () => {
    const node = makeNode("e", "search-engine", {
      plan: { technology: "Elasticsearch", indexName: "products, articles" },
    });
    const result = generateInitScripts(design([node]), new Map([["e", "search"]]));

    const file = result.files.find((f) => f.path === "init/search/create-indexes.sh");
    expect(file).toBeDefined();
    expect(String(file!.content)).toContain('PUT "http://search:9200/products"');
    expect(String(file!.content)).toContain('PUT "http://search:9200/articles"');

    const sidecar = result.sidecars.find((s) => s.name === "search-init");
    expect(sidecar).toBeDefined();
    expect(sidecar!.image).toContain("curl");
    expect(sidecar!.command).toContain("/_cluster/health");
  });
});

describe("generateInitScripts — ofelia cron", () => {
  it("emits config.ini with a job-exec when the cron node connects to a service", () => {
    const cron = makeNode("c", "cron", {
      label: "Nightly Cleanup",
      plan: {
        technology: "Cron (Linux)",
        schedule: "0 3 * * *",
        command: "node cleanup.js",
      },
    });
    const target = makeNode("svc", "service");
    const result = generateInitScripts(
      design([cron, target], [{ source: "c", target: "svc" }]),
      new Map([
        ["c", "cleanup-cron"],
        ["svc", "api"],
      ]),
    );

    const file = result.files.find((f) => f.path === "init/cleanup-cron/config.ini");
    expect(file).toBeDefined();
    const ini = String(file!.content);
    expect(ini).toContain('[job-exec "job-nightly-cleanup"]');
    expect(ini).toContain("schedule = 0 3 * * *");
    expect(ini).toContain("container = api");
    expect(ini).toContain("command = node cleanup.js");

    const mounts = result.mountsByNodeId.get("c") ?? [];
    expect(mounts).toContainEqual({
      host: "./init/cleanup-cron/config.ini",
      container: "/etc/ofelia/config.ini",
      readOnly: true,
    });
  });

  it("falls back to job-local when the cron isn't wired to anything", () => {
    const cron = makeNode("c", "cron", {
      plan: { technology: "Cron (Linux)", schedule: "@hourly", command: "echo hi" },
    });
    const result = generateInitScripts(design([cron]), new Map([["c", "cleanup-cron"]]));
    const ini = String(result.files[0].content);
    expect(ini).toContain("[job-local");
    expect(ini).not.toContain("container");
  });
});
