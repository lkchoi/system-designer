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
    { path: `${dir}/.dockerignore`, content: "node_modules\n.npm\nnpm-debug.log\n" },
  ];
  return { files, buildContext: `./${dir}`, containerPort: PORT };
}

function dockerfile(): string {
  return `FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
EXPOSE ${PORT}
CMD ["node", "src/index.js"]
`;
}

function packageJson(serviceName: string): string {
  return JSON.stringify(
    {
      name: serviceName,
      version: "0.1.0",
      private: true,
      type: "module",
      main: "src/index.js",
      scripts: {
        start: "node src/index.js",
      },
      dependencies: {},
    },
    null,
    2,
  ) + "\n";
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

  return `// Auto-scaffolded service. Implement business logic in this file (or split it).
// The container's env vars are wired up automatically by the bundle generator
// based on this Service's outgoing edges in the design.

import http from "node:http";

const PORT = Number(process.env.PORT ?? ${PORT});

const startedAt = Date.now();

const server = http.createServer((req, res) => {
  const url = (req.url ?? "/").split("?")[0];

  if (req.method === "GET" && url === "/health") {
    return json(res, 200, { ok: true, uptimeMs: Date.now() - startedAt });
  }

${handlers || "  // No endpoints declared on this Service node yet."}

  return json(res, 404, { error: "not found", url });
});

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("[${serviceName}] listening on port", PORT);
  for (const k of Object.keys(process.env).sort()) {
    if (/^(PATH|HOME|TERM|HOSTNAME|NODE_VERSION|YARN_VERSION)$/.test(k)) continue;
    console.log(\`  env \${k}=\${process.env[k]}\`);
  }
});
`;
}
