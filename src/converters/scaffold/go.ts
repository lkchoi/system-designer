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
    { path: `${dir}/main_test.go`, content: mainTestGo() },
    { path: `${dir}/.dockerignore`, content: ".git\n*.test\n*.out\n" },
  ];
  return {
    files,
    buildContext: `./${dir}`,
    containerPort: PORT,
    testCommand: "go test ./...",
  };
}

function dockerfile(): string {
  // Single-stage so \`docker compose run --rm <svc> go test ./...\` works
  // without rebuilding into a separate test image. Image is bigger than a
  // multi-stage scratch build, but local-deploy doesn't care.
  return `FROM golang:1.24-alpine
WORKDIR /app
COPY go.mod ./
COPY . .
RUN go build -o /usr/local/bin/app ./...
EXPOSE ${PORT}
CMD ["/usr/local/bin/app"]
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

var startedAt = time.Now()

// newMux returns the request multiplexer used by both the runtime server and
// the test suite, so tests can hit handlers without binding a port.
func newMux() *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":         true,
			"uptime_sec": time.Since(startedAt).Seconds(),
		})
	})

${handlers || "	// No endpoints declared on this Service node yet."}

	return mux
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "${PORT}"
	}

	logEnv()
	log.Printf("[${serviceName}] listening on :%s", port)
	if err := http.ListenAndServe(":"+port, newMux()); err != nil {
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

function mainTestGo(): string {
  return `package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthReturnsOK(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	newMux().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body["ok"] != true {
		t.Errorf("expected ok=true, got %v", body)
	}
}

func TestUnknownRouteIs404(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/no-such-route", nil)
	newMux().ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}
`;
}

function goModuleName(serviceName: string): string {
  return serviceName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "service";
}
