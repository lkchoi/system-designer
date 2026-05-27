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

describe("serverlessLLMGenerator — Python (HTTP)", () => {
  it("emits handler.py with API Gateway v2 shape + base64 body decode", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("HTTP", { language: "python" }));
    expect(files.map((f) => f.path).sort()).toEqual([
      "README.md",
      "handler.py",
      "prompt.md",
      "validate.sh",
    ]);
    const py = files.find((f) => f.path === "handler.py")!.contents;
    expect(py).toContain("import base64");
    expect(py).toContain("requestContext");
    expect(py).toContain('event.get("isBase64Encoded")');
    expect(py).toContain("from process import process as process_input");
    expect(py).toContain("async def handler");
  });

  it("Python prompt asks for TypedDict definitions", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("HTTP", { language: "python" }));
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("```python");
    expect(prompt).toContain("TypedDict");
    expect(prompt).toContain("async def process");
    expect(prompt).toContain("test_process.py");
  });
});

describe("serverlessLLMGenerator — Python (S3)", () => {
  it("emits handler.py with unquote_plus and partial-batch failure", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("S3 event", { language: "python" }));
    const py = files.find((f) => f.path === "handler.py")!.contents;
    expect(py).toContain("unquote_plus");
    expect(py).toContain("batchItemFailures");
    expect(py).toContain("from process import process as process_record");
  });
});

describe("serverlessLLMGenerator — Python (SQS / schedule)", () => {
  it("SQS handler iterates Records and reports batch failures", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("SQS", { language: "python" }));
    const py = files.find((f) => f.path === "handler.py")!.contents;
    expect(py).toContain("messageId");
    expect(py).toContain("batchItemFailures");
  });

  it("schedule handler parses event['time'] into datetime", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("schedule cron", { language: "python" }));
    const py = files.find((f) => f.path === "handler.py")!.contents;
    expect(py).toContain("datetime.fromisoformat");
    expect(py).not.toContain("batchItemFailures");
  });
});

describe("serverlessLLMGenerator — Go (HTTP)", () => {
  it("emits handler.go using aws-lambda-go/events", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("HTTP", { language: "go" }));
    expect(files.map((f) => f.path).sort()).toEqual([
      "README.md",
      "handler.go",
      "prompt.md",
      "validate.sh",
    ]);
    const go = files.find((f) => f.path === "handler.go")!.contents;
    expect(go).toContain("package handler");
    expect(go).toContain('"github.com/aws/aws-lambda-go/events"');
    expect(go).toContain("APIGatewayV2HTTPRequest");
    expect(go).toContain("APIGatewayV2HTTPResponse");
    expect(go).toContain("func Handle(ctx context.Context");
    expect(go).toContain("Process(ctx, in)");
  });

  it("Go prompt asks for HttpInput / HttpOutput struct definitions", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("HTTP", { language: "go" }));
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("```go");
    expect(prompt).toContain("HttpInput");
    expect(prompt).toContain("HttpOutput");
    expect(prompt).toContain("func Process(ctx context.Context");
  });
});

describe("serverlessLLMGenerator — Go (S3 / SQS / schedule)", () => {
  it("S3 handler uses events.S3Event with partial batch failure", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("S3", { language: "go" }));
    const go = files.find((f) => f.path === "handler.go")!.contents;
    expect(go).toContain("events.S3Event");
    expect(go).toContain("BatchItemFailures");
    expect(go).toContain("url.QueryUnescape");
  });

  it("SQS handler uses events.SQSEvent", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("SQS", { language: "go" }));
    const go = files.find((f) => f.path === "handler.go")!.contents;
    expect(go).toContain("events.SQSEvent");
    expect(go).toContain("BatchItemFailures");
  });

  it("schedule handler uses events.CloudWatchEvent", async () => {
    const files = await serverlessLLMGenerator.generate(ctx("schedule rate(1 hour)", { language: "go" }));
    const go = files.find((f) => f.path === "handler.go")!.contents;
    expect(go).toContain("events.CloudWatchEvent");
    expect(go).not.toContain("BatchItemFailures");
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
