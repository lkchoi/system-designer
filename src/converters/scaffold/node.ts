import type { Endpoint } from "../../types";
import type { BundleFile } from "../bundle";
import type { ScaffoldRequest, ScaffoldResult } from "./index";

const PORT = 8080;

export function scaffoldNodeService(req: ScaffoldRequest): ScaffoldResult {
  const dir = `services/${req.serviceName}`;
  const files: BundleFile[] = [
    { path: `${dir}/Dockerfile`, content: dockerfile() },
    { path: `${dir}/package.json`, content: packageJson(req.serviceName) },
    { path: `${dir}/src/index.js`, content: indexJs(req.serviceName, req.endpoints) },
    { path: `${dir}/test/health.test.js`, content: healthTestJs() },
    { path: `${dir}/.dockerignore`, content: "node_modules\n.npm\nnpm-debug.log\n" },
  ];
  return {
    files,
    buildContext: `./${dir}`,
    containerPort: PORT,
    testCommand: "npm test",
  };
}

function dockerfile(): string {
  // Dev deps are included so `docker compose run --rm <svc> npm test` works
  // out of the box. This is local-deploy only — image size doesn't matter.
  return `FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE ${PORT}
CMD ["node", "src/index.js"]
`;
}

function packageJson(serviceName: string): string {
  return (
    JSON.stringify(
      {
        name: serviceName,
        version: "0.1.0",
        private: true,
        type: "module",
        main: "src/index.js",
        scripts: {
          start: "node src/index.js",
          test: "vitest run",
        },
        dependencies: {},
        devDependencies: {
          vitest: "^2.1.8",
        },
      },
      null,
      2,
    ) + "\n"
  );
}

function indexJs(serviceName: string, endpoints: Endpoint[]): string {
  const handlers = endpoints
    .filter((ep) => ep.path && ep.method)
    .map(
      (ep) => `  if (req.method === "${ep.method.toUpperCase()}" && url === "${ep.path}") {
    return json(res, 200, { endpoint: "${ep.method.toUpperCase()} ${ep.path}", service: "${serviceName}" });
  }`,
    )
    .join("\n");

  return `// Auto-scaffolded service. Implement business logic here.
// The container's env vars are wired up automatically by the bundle generator
// based on this Service's outgoing edges in the design.

import http from "node:http";

const PORT = Number(process.env.PORT ?? ${PORT});
const startedAt = Date.now();

export function makeHandler() {
  return (req, res) => {
    const url = (req.url ?? "/").split("?")[0];

    if (req.method === "GET" && url === "/health") {
      return json(res, 200, { ok: true, uptimeMs: Date.now() - startedAt });
    }

${handlers || "    // No endpoints declared on this Service node yet."}

    return json(res, 404, { error: "not found", url });
  };
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

// CLI entrypoint — only runs when invoked directly, not when imported by tests.
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const server = http.createServer(makeHandler());
  server.listen(PORT, "0.0.0.0", () => {
    console.log("[${serviceName}] listening on port", PORT);
    for (const k of Object.keys(process.env).sort()) {
      if (/^(PATH|HOME|TERM|HOSTNAME|NODE_VERSION|YARN_VERSION)$/.test(k)) continue;
      console.log(\`  env \${k}=\${process.env[k]}\`);
    }
  });
}
`;
}

function healthTestJs(): string {
  return `import { describe, it, expect } from "vitest";
import http from "node:http";
import { makeHandler } from "../src/index.js";

async function withServer(fn) {
  const server = http.createServer(makeHandler());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    return await fn(port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe("/health", () => {
  it("returns ok=true and an uptime", async () => {
    await withServer(async (port) => {
      const res = await fetch(\`http://127.0.0.1:\${port}/health\`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(typeof body.uptimeMs).toBe("number");
    });
  });

  it("returns 404 for unknown routes", async () => {
    await withServer(async (port) => {
      const res = await fetch(\`http://127.0.0.1:\${port}/no-such-route\`);
      expect(res.status).toBe(404);
    });
  });
});
`;
}
