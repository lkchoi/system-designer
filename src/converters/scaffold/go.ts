import type { Endpoint } from "../../types";
import type { BundleFile } from "../bundle";
import type { ScaffoldRequest, ScaffoldResult } from "./index";

const PORT = 8080;

export function scaffoldGoService(req: ScaffoldRequest): ScaffoldResult {
  const dir = `services/${req.serviceName}`;
  const mod = goModuleName(req.serviceName);
  const files: BundleFile[] = [
    { path: `${dir}/Dockerfile`, content: dockerfile() },
    { path: `${dir}/go.mod`, content: goMod(mod) },
    { path: `${dir}/main.go`, content: mainGo(req.serviceName, req.endpoints) },
    { path: `${dir}/.dockerignore`, content: ".git\n*.test\n*.out\n" },
  ];
  return { files, buildContext: `./${dir}`, containerPort: PORT };
}

function dockerfile(): string {
  return `# syntax=docker/dockerfile:1.7
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/app ./...

FROM alpine:3.20
COPY --from=build /out/app /usr/local/bin/app
EXPOSE ${PORT}
ENTRYPOINT ["/usr/local/bin/app"]
`;
}

function goMod(module: string): string {
  return `module ${module}

go 1.24
`;
}

function mainGo(serviceName: string, endpoints: Endpoint[]): string {
  const handlers = endpoints
    .filter((ep) => ep.path && ep.method)
    .map(
      (ep) => `	mux.HandleFunc("${ep.path}", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "${ep.method.toUpperCase()}" {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{
			"endpoint": "${ep.method.toUpperCase()} ${ep.path}",
			"service":  "${serviceName}",
		})
	})`,
    )
    .join("\n\n");

  return `// Auto-scaffolded service. Implement business logic in this file (or split it).
// The container's env vars are wired up automatically by the bundle generator
// based on this Service's outgoing edges in the design.

package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "${PORT}"
	}

	startedAt := time.Now()
	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":         true,
			"uptime_sec": time.Since(startedAt).Seconds(),
		})
	})

${handlers || "	// No endpoints declared on this Service node yet."}

	logEnv()
	log.Printf("[${serviceName}] listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("listen: %v", err)
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func logEnv() {
	skip := map[string]struct{}{
		"PATH": {}, "HOME": {}, "TERM": {}, "HOSTNAME": {}, "SHELL": {}, "PWD": {},
	}
	keys := make([]string, 0, len(os.Environ()))
	for _, kv := range os.Environ() {
		idx := strings.IndexByte(kv, '=')
		if idx < 0 {
			continue
		}
		k := kv[:idx]
		if _, drop := skip[k]; drop {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		log.Printf("  env %s=%s", k, os.Getenv(k))
	}
}
`;
}

function goModuleName(serviceName: string): string {
  return serviceName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "service";
}
