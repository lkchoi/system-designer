import { describe, expect, it } from "vitest";
import { serverlessLLMGenerator } from "./serverless-llm";
import type { GeneratorContext } from "../types";

function ctx(trigger: string, overrides: Partial<GeneratorContext> = {}): GeneratorContext {
  return {
    node: {
      id: "fn1",
      label: "Image Resizer",
      description: "Resize uploaded images.",
      componentType: "serverless",
      plan: { technology: "aws-lambda", trigger },
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
    language: "node",
    ...overrides,
  };
}

describe("serverlessLLMGenerator — fallback (non-Node)", () => {
  it("falls back to a guided bundle for Python", async () => {
    const c = ctx("HTTP", { language: "python" });
    const files = await serverlessLLMGenerator.generate(c);
    expect(files.map((f) => f.path).sort()).toEqual(["README.md", "prompt.md", "validate.sh"]);
    expect(files.find((f) => f.path === "handler.ts")).toBeUndefined();
    expect(files.find((f) => f.path === "prompt.md")!.contents).toContain("<serverless>");
  });
});

describe("serverlessLLMGenerator — HTTP trigger", () => {
  it("emits handler.ts with API Gateway v2 shape", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("HTTP"));
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "handler.ts", "prompt.md", "validate.sh"]);
    const h = files.find((f) => f.path === "handler.ts")!.contents;
    expect(h).toContain("ApiGatewayV2Event");
    expect(h).toContain("requestContext");
    expect(h).toContain("isBase64Encoded");
    expect(h).toContain("HttpInput");
    expect(h).toContain("HttpOutput");
    expect(h).toContain('"content-type": "application/json"');
  });

  it("prompt exports the expected HttpInput/HttpOutput contract", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("HTTP"));
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("Trigger detected: **http**");
    expect(prompt).toContain("type HttpInput");
    expect(prompt).toContain("type HttpOutput");
    expect(prompt).toContain("do NOT regenerate `handler.ts`");
  });

  it("defaults to HTTP when trigger is empty", async () => {
    const files = await serverlessLLMGenerator.generate(ctx(""));
    const h = files.find((f) => f.path === "handler.ts")!.contents;
    expect(h).toContain("ApiGatewayV2Event");
  });
});

describe("serverlessLLMGenerator — S3 trigger", () => {
  it("emits handler.ts that iterates S3 Records with partial-batch failure", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("S3 event"));
    const h = files.find((f) => f.path === "handler.ts")!.contents;
    expect(h).toContain('eventSource: "aws:s3"');
    expect(h).toContain("batchItemFailures");
    expect(h).toContain("S3Record");
    expect(h).toContain("decodeURIComponent");
  });

  it("prompt references one-record process signature", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("S3 event"));
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("Trigger detected: **s3**");
    expect(prompt).toContain("type S3Record");
    expect(prompt).toContain("process(record: S3Record)");
  });
});

describe("serverlessLLMGenerator — SQS trigger", () => {
  it("emits handler.ts that iterates SQS Records with partial-batch failure", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("SQS messages"));
    const h = files.find((f) => f.path === "handler.ts")!.contents;
    expect(h).toContain('eventSource: "aws:sqs"');
    expect(h).toContain("SqsMessage");
    expect(h).toContain("batchItemFailures");
  });

  it("matches 'message-queue' trigger text too", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("message-queue Kafka topic"));
    const h = files.find((f) => f.path === "handler.ts")!.contents;
    expect(h).toContain("SqsMessage");
  });
});

describe("serverlessLLMGenerator — schedule trigger", () => {
  it("emits handler.ts with EventBridge shape, no partial-batch contract", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("schedule cron 0 * * * *"));
    const h = files.find((f) => f.path === "handler.ts")!.contents;
    expect(h).toContain("EventBridgeEvent");
    expect(h).toContain("aws.events");
    expect(h).toContain("ScheduleEvent");
    expect(h).not.toContain("batchItemFailures");
  });

  it("prompt notes idempotency for retries", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("schedule rate(1 hour)"));
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("Trigger detected: **schedule**");
    expect(prompt).toContain("Idempotent");
  });
});
