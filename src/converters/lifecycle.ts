import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { resolveTechId } from "./iac-mapping";

/**
 * URL row printed by start.sh after the stack is healthy.
 */
export interface ServiceUrl {
  label: string;
  url: string;
}

/**
 * Health check command run inside `start.sh` to wait for a service.
 */
interface HealthCheck {
  serviceName: string;
  /** A bash one-liner that returns 0 when the service is ready. */
  cmd: string;
}

export interface LifecycleScripts {
  startSh: string;
  stopSh: string;
  resetSh: string;
}

export function buildLifecycleScripts(
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
  hostPortByNodeId: Map<string, number[]>,
): LifecycleScripts {
  const checks: HealthCheck[] = [];
  const urls: ServiceUrl[] = [];

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    const name = serviceNameByNodeId.get(node.id);
    if (!name) continue;
    const ports = hostPortByNodeId.get(node.id) ?? [];
    const techId = resolveTechId(data.componentType, data.plan?.technology ?? "", "docker");

    const check = healthCheckFor(data.componentType, techId, name);
    if (check) checks.push(check);

    for (const url of urlsFor(data.componentType, techId, name, ports)) urls.push(url);
  }

  return {
    startSh: renderStart(checks, urls),
    stopSh: renderStop(),
    resetSh: renderReset(),
  };
}

function healthCheckFor(
  componentType: SystemNodeData["componentType"],
  techId: string,
  serviceName: string,
): HealthCheck | null {
  switch (componentType) {
    case "database":
      if (techId === "postgresql" || techId === "cockroachdb" || techId === "aurora")
        return {
          serviceName,
          cmd: `docker compose exec -T ${serviceName} pg_isready -U admin`,
        };
      if (techId === "mysql" || techId === "mariadb")
        return {
          serviceName,
          cmd: `docker compose exec -T ${serviceName} mysqladmin ping --silent`,
        };
      if (techId === "mongodb")
        return {
          serviceName,
          cmd: `docker compose exec -T ${serviceName} mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok'`,
        };
      return null;
    case "cache":
      if (techId === "redis")
        return {
          serviceName,
          cmd: `docker compose exec -T ${serviceName} redis-cli ping | grep -q PONG`,
        };
      return null;
    case "message-queue":
      if (techId === "kafka")
        return {
          serviceName,
          cmd: `docker compose exec -T ${serviceName} kafka-topics --bootstrap-server localhost:9092 --list`,
        };
      if (techId === "rabbitmq")
        return {
          serviceName,
          cmd: `docker compose exec -T ${serviceName} rabbitmq-diagnostics ping`,
        };
      if (techId === "redis")
        return {
          serviceName,
          cmd: `docker compose exec -T ${serviceName} redis-cli ping | grep -q PONG`,
        };
      return null;
    case "storage":
      if (techId === "s3" || techId === "minio")
        return {
          serviceName,
          cmd: `curl -sf http://localhost:$(docker compose port ${serviceName} 9000 | cut -d: -f2)/minio/health/live`,
        };
      return null;
    case "search-engine":
      if (techId === "elasticsearch" || techId === "opensearch")
        return {
          serviceName,
          cmd: `curl -sf http://localhost:$(docker compose port ${serviceName} 9200 | cut -d: -f2)/_cluster/health?wait_for_status=yellow`,
        };
      return null;
    default:
      return null;
  }
}

/**
 * URLs to print for a single node, given its host ports. Exported because the
 * README generator needs the same logic to keep its URL table aligned with
 * what `start.sh` prints at the end of a successful boot.
 */
export function urlsFor(
  componentType: SystemNodeData["componentType"],
  techId: string,
  serviceName: string,
  hostPorts: number[],
): ServiceUrl[] {
  const port = hostPorts[0];
  if (port == null) return [];
  switch (componentType) {
    case "database":
      if (techId === "postgresql" || techId === "cockroachdb" || techId === "aurora")
        return [{ label: serviceName, url: `postgres://admin@localhost:${port}/app` }];
      if (techId === "mysql" || techId === "mariadb")
        return [{ label: serviceName, url: `mysql://root@localhost:${port}` }];
      if (techId === "mongodb") return [{ label: serviceName, url: `mongodb://localhost:${port}` }];
      return [{ label: serviceName, url: `localhost:${port}` }];
    case "cache":
      return [{ label: serviceName, url: `redis://localhost:${port}` }];
    case "message-queue":
      if (techId === "kafka") return [{ label: serviceName, url: `localhost:${port} (kafka)` }];
      if (techId === "rabbitmq")
        return [
          { label: serviceName, url: `amqp://guest:guest@localhost:${port}` },
          ...(hostPorts[1] != null
            ? [{ label: `${serviceName} mgmt`, url: `http://localhost:${hostPorts[1]}` }]
            : []),
        ];
      return [{ label: serviceName, url: `localhost:${port}` }];
    case "storage":
      return [
        { label: `${serviceName} api`, url: `http://localhost:${port}` },
        ...(hostPorts[1] != null
          ? [{ label: `${serviceName} console`, url: `http://localhost:${hostPorts[1]}` }]
          : []),
      ];
    case "search-engine":
      return [{ label: serviceName, url: `http://localhost:${port}` }];
    case "service":
    case "serverless":
      return [{ label: serviceName, url: `http://localhost:${port}` }];
    default:
      return [{ label: serviceName, url: `http://localhost:${port}` }];
  }
}

function renderStart(checks: HealthCheck[], urls: ServiceUrl[]): string {
  const checkLines = checks
    .map(
      (c) => `echo "→ waiting for ${c.serviceName}…"
for i in $(seq 1 60); do
  if ${c.cmd} >/dev/null 2>&1; then
    echo "  ✓ ${c.serviceName} ready"
    break
  fi
  sleep 1
  if [ $i -eq 60 ]; then
    echo "  ✗ ${c.serviceName} did not become ready within 60s"
    exit 1
  fi
done`,
    )
    .join("\n\n");

  const urlLines = urls.length
    ? urls.map((u) => `  printf "  %-32s %s\\n" "${u.label}" "${u.url}"`).join("\n")
    : '  echo "  (no service URLs)"';

  return `#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "→ docker compose up -d"
docker compose up -d

${checkLines}

echo
echo "Stack is up. URLs:"
${urlLines}

echo
echo "Use ./stop.sh to halt or ./reset.sh to wipe data."
`;
}

function renderStop(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "→ docker compose down"
docker compose down

if [ -d ./.pids ]; then
  for pidfile in ./.pids/*.pid; do
    [ -f "$pidfile" ] || continue
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      echo "→ killing background process $pid ($(basename "$pidfile" .pid))"
      kill "$pid" || true
    fi
    rm -f "$pidfile"
  done
fi
`;
}

function renderReset(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "→ docker compose down -v (this wipes all data volumes)"
docker compose down -v

rm -rf ./data ./.pids

echo "Stack reset. Re-run ./start.sh to bring it back up."
`;
}
