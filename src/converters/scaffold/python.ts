import type { Endpoint } from "../../types";
import type { BundleFile } from "../bundle";
import type { ScaffoldRequest, ScaffoldResult } from "./index";

const PORT = 8000;

export function scaffoldPythonService(req: ScaffoldRequest): ScaffoldResult {
  const dir = `services/${req.serviceName}`;
  const files: BundleFile[] = [
    { path: `${dir}/Dockerfile`, content: dockerfile() },
    { path: `${dir}/requirements.txt`, content: requirements() },
    { path: `${dir}/src/main.py`, content: mainPy(req.serviceName, req.endpoints) },
    { path: `${dir}/.dockerignore`, content: "__pycache__\n*.pyc\n.venv\n.pytest_cache\n" },
  ];
  return { files, buildContext: `./${dir}`, containerPort: PORT };
}

function dockerfile(): string {
  return `FROM python:3.13-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src
EXPOSE ${PORT}
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "${PORT}"]
`;
}

function requirements(): string {
  return `fastapi==0.115.5
uvicorn[standard]==0.32.1
`;
}

function mainPy(serviceName: string, endpoints: Endpoint[]): string {
  const handlers = endpoints
    .filter((ep) => ep.path && ep.method)
    .map((ep) => {
      const fnName = `handle_${ep.method.toLowerCase()}_${slug(ep.path)}`;
      const decorator = `@app.${ep.method.toLowerCase()}("${ep.path}")`;
      return `${decorator}
def ${fnName}():
    return {"endpoint": "${ep.method.toUpperCase()} ${ep.path}", "service": "${serviceName}"}`;
    })
    .join("\n\n\n");

  return `"""Auto-scaffolded FastAPI service. Implement business logic here.

The container's env vars are wired up automatically by the bundle generator
based on this Service's outgoing edges in the design.
"""

import os
import time
from fastapi import FastAPI

app = FastAPI(title="${serviceName}")
_started_at = time.monotonic()


@app.get("/health")
def health():
    return {"ok": True, "uptime_seconds": time.monotonic() - _started_at}


${handlers || "# No endpoints declared on this Service node yet."}


@app.on_event("startup")
def _log_env():
    skip = {"PATH", "HOME", "TERM", "HOSTNAME", "PYTHON_VERSION", "LANG", "LC_ALL"}
    for k in sorted(os.environ):
        if k in skip:
            continue
        print(f"  env {k}={os.environ[k]}")
`;
}

function slug(path: string): string {
  return path.replace(/^\/+/, "").replace(/[^a-zA-Z0-9]+/g, "_") || "root";
}
