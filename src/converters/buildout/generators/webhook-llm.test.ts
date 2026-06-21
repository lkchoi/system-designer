import { describe, expect, it } from "vitest";
import { webhookLLMGenerator } from "./webhook-llm";
import type { EdgeRef, GeneratorContext } from "../types";

function ctx(overrides: Partial<GeneratorContext> = {}): GeneratorContext {
  return {
    node: {
      id: "wh1",
      label: "Stripe Webhook",
      description: "Receive Stripe events.",
      componentType: "webhook",
      plan: { technology: "https", url: "https://api.example.com/stripe", method: "POST" },
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

const dbEdge: EdgeRef = {
  otherNodeId: "db",
  otherNodeLabel: "events-db",
  otherComponentType: "database",
  otherTechId: "postgresql",
};

const srcEdge: EdgeRef = {
  otherNodeId: "svc",
  otherNodeLabel: "orders-svc",
  otherComponentType: "service",
  otherTechId: "nodejs",
};

describe("webhookLLMGenerator — inbound hybrid (TS)", () => {
  function inboundCtx() {
    return ctx({ outbound: [dbEdge] });
  }

  it("emits receiver.ts + process bundle", async () => {
    const files = await webhookLLMGenerator.generate(inboundCtx());
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "prompt.md", "receiver.ts", "validate.sh"]);
  });

  it("receiver.ts uses timing-safe HMAC compare via node:crypto", async () => {
    const files = await webhookLLMGenerator.generate(inboundCtx());
    const recv = files.find((f) => f.path === "receiver.ts")!.contents;
    expect(recv).toContain('from "node:crypto"');
    expect(recv).toContain("timingSafeEqual");
    expect(recv).toContain("createHmac(\"sha256\"");
    expect(recv).toContain('import { process as processPayload } from "./process";');
    // Method enforcement
    expect(recv).toContain('"POST"');
    // 401 / 400 / 500 surfaces
    expect(recv).toContain("statusCode = 401");
    expect(recv).toContain("invalid_signature");
    expect(recv).toContain("invalid_json");
    expect(recv).toContain("internal_error");
  });

  it("receiver.ts strips an optional sha256= signature prefix", async () => {
    const files = await webhookLLMGenerator.generate(inboundCtx());
    const recv = files.find((f) => f.path === "receiver.ts")!.contents;
    expect(recv).toContain('signature.startsWith("sha256=")');
  });

  it("prompt asks for process.ts only and references receiver.ts", async () => {
    const files = await webhookLLMGenerator.generate(inboundCtx());
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("<hybrid-skeleton>");
    expect(prompt).toContain("process.ts");
    expect(prompt).toContain("do NOT regenerate `receiver.ts`");
    expect(prompt).toContain("export async function process(payload: unknown)");
    // Skeleton embedded
    expect(prompt).toContain("verifySignature");
  });
});

describe("webhookLLMGenerator — outbound hybrid (TS)", () => {
  function outboundCtx() {
    return ctx({ inbound: [srcEdge] });
  }

  it("emits emitter.ts + payload bundle", async () => {
    const files = await webhookLLMGenerator.generate(outboundCtx());
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "emitter.ts", "prompt.md", "validate.sh"]);
  });

  it("emitter.ts signs, sets idempotency-key, retries on 5xx with backoff", async () => {
    const files = await webhookLLMGenerator.generate(outboundCtx());
    const em = files.find((f) => f.path === "emitter.ts")!.contents;
    expect(em).toContain('createHmac("sha256"');
    expect(em).toContain("randomUUID");
    expect(em).toContain("x-idempotency-key");
    expect(em).toContain("MAX_ATTEMPTS");
    // 4xx no-retry path
    expect(em).toContain("res.status < 500");
    // Backoff
    expect(em).toContain("200 * 2 ** (attempt - 1)");
    // Timeout via AbortController
    expect(em).toContain("AbortController");
  });

  it("emitter.ts pulls URL from plan but allows env override", async () => {
    const files = await webhookLLMGenerator.generate(outboundCtx());
    const em = files.find((f) => f.path === "emitter.ts")!.contents;
    expect(em).toContain("process.env.WEBHOOK_URL");
    expect(em).toContain("https://api.example.com/stripe");
  });

  it("prompt asks for payload.ts only and references emitter.ts", async () => {
    const files = await webhookLLMGenerator.generate(outboundCtx());
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("payload.ts");
    expect(prompt).toContain("do NOT regenerate `emitter.ts`");
    expect(prompt).toContain("export async function buildPayload");
  });
});

describe("webhookLLMGenerator — inbound hybrid (Python)", () => {
  it("emits receiver.py with FastAPI + hmac.compare_digest", async () => {
    const files = await webhookLLMGenerator.generate(
      ctx({ language: "python", outbound: [dbEdge] }),
    );
    expect(files.map((f) => f.path).sort()).toEqual([
      "README.md",
      "prompt.md",
      "receiver.py",
      "validate.sh",
    ]);
    const py = files.find((f) => f.path === "receiver.py")!.contents;
    expect(py).toContain("from fastapi import FastAPI");
    expect(py).toContain("hmac.compare_digest");
    expect(py).toContain('startswith("sha256=")');
    expect(py).toContain("from process import process as process_payload");
  });

  it("prompt asks for process.py with async def signature", async () => {
    const files = await webhookLLMGenerator.generate(
      ctx({ language: "python", outbound: [dbEdge] }),
    );
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("```python");
    expect(prompt).toContain("async def process");
    expect(prompt).toContain("process.py");
    expect(prompt).toContain("test_process.py");
  });
});

describe("webhookLLMGenerator — outbound hybrid (Python)", () => {
  it("emits emitter.py with httpx + HMAC + idempotency + backoff", async () => {
    const files = await webhookLLMGenerator.generate(
      ctx({ language: "python", inbound: [srcEdge] }),
    );
    expect(files.map((f) => f.path).sort()).toEqual([
      "README.md",
      "emitter.py",
      "prompt.md",
      "validate.sh",
    ]);
    const py = files.find((f) => f.path === "emitter.py")!.contents;
    expect(py).toContain("import httpx");
    expect(py).toContain("hmac.new");
    expect(py).toContain("uuid.uuid4()");
    expect(py).toContain("x-idempotency-key");
    expect(py).toContain("asyncio.sleep(0.2");
  });
});

describe("webhookLLMGenerator — inbound hybrid (Go)", () => {
  it("emits receiver.go with subtle.ConstantTimeCompare", async () => {
    const files = await webhookLLMGenerator.generate(
      ctx({ language: "go", outbound: [dbEdge] }),
    );
    expect(files.map((f) => f.path).sort()).toEqual([
      "README.md",
      "prompt.md",
      "receiver.go",
      "validate.sh",
    ]);
    const go = files.find((f) => f.path === "receiver.go")!.contents;
    expect(go).toContain("package webhook");
    expect(go).toContain("subtle.ConstantTimeCompare");
    expect(go).toContain('strings.TrimPrefix(signature, "sha256=")');
    expect(go).toContain("func VerifySignature");
    expect(go).toContain("Process(r.Context()");
  });

  it("prompt asks for process.go with context-aware signature", async () => {
    const files = await webhookLLMGenerator.generate(
      ctx({ language: "go", outbound: [dbEdge] }),
    );
    const prompt = files.find((f) => f.path === "prompt.md")!.contents;
    expect(prompt).toContain("```go");
    expect(prompt).toContain("func Process(ctx context.Context");
    expect(prompt).toContain("process.go");
    expect(prompt).toContain("process_test.go");
  });
});

describe("webhookLLMGenerator — outbound hybrid (Go)", () => {
  it("emits emitter.go with http.Client + retry + idempotency", async () => {
    const files = await webhookLLMGenerator.generate(
      ctx({ language: "go", inbound: [srcEdge] }),
    );
    expect(files.map((f) => f.path).sort()).toEqual([
      "README.md",
      "emitter.go",
      "prompt.md",
      "validate.sh",
    ]);
    const go = files.find((f) => f.path === "emitter.go")!.contents;
    expect(go).toContain("package webhook");
    expect(go).toContain("hmac.New");
    expect(go).toContain("uuid.NewString()");
    expect(go).toContain("x-idempotency-key");
    expect(go).toContain("func Emit(ctx context.Context");
    expect(go).toContain("BuildPayload(input)");
  });
});
