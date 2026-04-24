import { describe, it, expect, beforeEach, vi } from "vitest";
import JSZip from "jszip";
import { dockerComposeConverter } from "./docker-compose";
import type { DesignJSON } from "../db/io";

beforeEach(() => {
  // Stable secrets for snapshot-style assertions.
  let counter = 0;
  vi.spyOn(crypto, "getRandomValues").mockImplementation(
    <T extends ArrayBufferView | null>(arr: T): T => {
      const view = new Uint8Array(arr!.buffer, arr!.byteOffset, arr!.byteLength);
      for (let i = 0; i < view.length; i++) view[i] = (counter++ + i) & 0xff;
      return arr;
    },
  );
});

const SAMPLE_DESIGN: DesignJSON = {
  version: 1,
  name: "OrdersPlatform",
  nodes: [
    {
      id: "svc",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "API",
        description: "Public REST surface",
        componentType: "service",
        plan: { technology: "Node.js (Express/Fastify)" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "db",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "OrdersDB",
        componentType: "database",
        plan: {
          technology: "PostgreSQL",
          database: "orders",
          tables: "users, orders, line_items",
          primaryKey: "id (UUID)",
          indexes: "users_email_idx",
        },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "cache",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "Sessions",
        componentType: "cache",
        plan: { technology: "Redis" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "bucket",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "Uploads",
        componentType: "storage",
        plan: { technology: "Amazon S3", bucketName: "uploads, archive" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "fn",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "ImageResizer",
        componentType: "serverless",
        plan: { technology: "AWS Lambda" },
        endpoints: [],
        links: [],
      },
    },
    {
      id: "lb",
      type: "system",
      position: { x: 0, y: 0 },
      data: {
        label: "Edge LB",
        componentType: "load-balancer",
        plan: { technology: "AWS ALB" },
        endpoints: [],
        links: [],
      },
    },
  ] as unknown as DesignJSON["nodes"],
  edges: [
    { id: "e1", source: "svc", target: "db" },
    { id: "e2", source: "svc", target: "cache" },
    { id: "e3", source: "svc", target: "bucket" },
  ] as unknown as DesignJSON["edges"],
  viewport: { x: 0, y: 0, zoom: 1 },
  flowPaths: [],
};

async function loadZip(): Promise<JSZip> {
  const result = await dockerComposeConverter.exportDesign(SAMPLE_DESIGN);
  expect(result.content).toBeInstanceOf(Blob);
  const buf = await (result.content as Blob).arrayBuffer();
  return JSZip.loadAsync(buf);
}

async function unpackBundle(): Promise<Map<string, string>> {
  const zip = await loadZip();
  const out = new Map<string, string>();
  await Promise.all(
    Object.values(zip.files).map(async (f) => {
      if (!f.dir) out.set(f.name, await f.async("string"));
    }),
  );
  return out;
}

describe("docker-compose bundle", () => {
  it("packs top-level files, init scripts, and the scaffolded service", async () => {
    const files = await unpackBundle();
    expect([...files.keys()].sort()).toEqual([
      ".env",
      "README.md",
      "docker-compose.yaml",
      "init/ordersdb/schema.sql",
      "init/uploads/create-buckets.sh",
      "reset.sh",
      "services/api/.dockerignore",
      "services/api/Dockerfile",
      "services/api/package.json",
      "services/api/src/index.js",
      "services/api/test/health.test.js",
      "start.sh",
      "stop.sh",
      "test.sh",
    ]);
  });

  it("adds an uploads-init sidecar service to compose for MinIO bucket creation", async () => {
    const files = await unpackBundle();
    const compose = files.get("docker-compose.yaml")!;
    expect(compose).toContain("uploads-init:");
    expect(compose).toContain("image: minio/mc:latest");
    expect(compose).toContain("mc mb --ignore-existing local/uploads");
    expect(compose).toContain("mc mb --ignore-existing local/archive");
  });

  it("test.sh runs each scaffolded service's tests via docker compose", async () => {
    const files = await unpackBundle();
    const testSh = files.get("test.sh")!;
    expect(testSh).toContain("docker compose run --rm --no-deps api npm test");
    expect(testSh).toContain('echo "→ tests for api"');
  });

  it("compose entry uses build.context for the scaffolded service", async () => {
    const files = await unpackBundle();
    const compose = files.get("docker-compose.yaml")!;
    expect(compose).toMatch(
      /api:\s*\n\s*restart: unless-stopped\s*\n\s*build:\s*\n\s*context: \.\/services\/api/,
    );
  });

  it("generates a CREATE TABLE for each declared table", async () => {
    const files = await unpackBundle();
    const sql = files.get("init/ordersdb/schema.sql")!;
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS orders");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS line_items");
    expect(sql).toContain("users_email_idx");
  });

  it("mounts init scripts into the postgres container", async () => {
    const files = await unpackBundle();
    const compose = files.get("docker-compose.yaml")!;
    expect(compose).toContain("./init/ordersdb:/docker-entrypoint-initdb.d:ro");
  });

  it("excludes the load-balancer from compose services", async () => {
    const files = await unpackBundle();
    const compose = files.get("docker-compose.yaml")!;
    expect(compose).toContain("api:");
    expect(compose).toContain("ordersdb:");
    expect(compose).toContain("sessions:");
    expect(compose).not.toMatch(/^\s+edge-lb:/m);
  });

  it("wires DATABASE_URL and REDIS_URL into the api service", async () => {
    const files = await unpackBundle();
    const compose = files.get("docker-compose.yaml")!;
    expect(compose).toContain(
      "DATABASE_URL: postgres://admin:${ORDERSDB_PASSWORD}@ordersdb:5432/orders",
    );
    expect(compose).toContain("REDIS_URL: redis://sessions:6379");
  });

  it("emits a random password var per stateful service in .env", async () => {
    const files = await unpackBundle();
    const env = files.get(".env")!;
    expect(env).toMatch(/^ORDERSDB_PASSWORD=[A-Za-z0-9_-]+$/m);
    expect(env).not.toContain("changeme");
  });

  it("documents the load-balancer in README's production-only section", async () => {
    const files = await unpackBundle();
    const readme = files.get("README.md")!;
    expect(readme).toContain("## Production-only components");
    expect(readme).toContain("### Load Balancers");
    expect(readme).toContain("Edge LB");
  });

  it("surfaces dropped AWS Lambda node under 'not yet runnable locally'", async () => {
    const files = await unpackBundle();
    const readme = files.get("README.md")!;
    expect(readme).toContain("## Cloud services not yet runnable locally");
    expect(readme).toContain("### AWS");
    expect(readme).toContain("LocalStack");
    expect(readme).toContain("ImageResizer");
    // Also confirm the Lambda node is NOT in compose.
    const compose = files.get("docker-compose.yaml")!;
    expect(compose).not.toMatch(/^\s+imageresizer:/m);
  });

  it("makes shell scripts executable", async () => {
    const zip = await loadZip();
    const start = zip.files["start.sh"];
    expect(start.unixPermissions).toBe(0o755);
    const compose = zip.files["docker-compose.yaml"];
    expect(compose.unixPermissions).toBe(0o644);
  });

  it("returns a .zip filename", async () => {
    const result = await dockerComposeConverter.exportDesign(SAMPLE_DESIGN);
    expect(result.filename).toBe("local-stack.zip");
    expect(result.mimeType).toBe("application/zip");
  });

  it("prefixes every line of a multi-line description with #", async () => {
    const design: DesignJSON = {
      version: 1,
      name: "X",
      nodes: [
        {
          id: "svc",
          type: "system",
          position: { x: 0, y: 0 },
          data: {
            label: "API",
            description: "1. Parse mentions\n2. CRUD comments\n3. Pub notifications",
            componentType: "service",
            plan: { technology: "Node.js (Express/Fastify)" },
            endpoints: [],
            links: [],
          },
        },
      ] as unknown as DesignJSON["nodes"],
      edges: [] as unknown as DesignJSON["edges"],
      viewport: { x: 0, y: 0, zoom: 1 },
      flowPaths: [],
    };
    const result = await dockerComposeConverter.exportDesign(design);
    const buf = await (result.content as Blob).arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const compose = await zip.files["docker-compose.yaml"].async("string");
    expect(compose).toContain("  # 1. Parse mentions\n  # 2. CRUD comments\n  # 3. Pub notifications\n  api:");
  });
});
