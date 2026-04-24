import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";
import { resolveTechId } from "./iac-mapping";

/**
 * Per-stateful-node secrets and the .env file that holds them.
 *
 * Two consumers:
 * - `containerEnv[nodeId]` is merged into the compose service for that node
 *   so the container starts with POSTGRES_PASSWORD / MYSQL_ROOT_PASSWORD /
 *   MINIO_ROOT_USER / etc. set.
 * - `envFileContent` is written to `.env` at the bundle root; downstream
 *   compose entries reference these via `${VAR}` (the values wiring.ts emits).
 *
 * Var names are `<UPPER_SERVICE_NAME>_<SECRET>`, e.g. ORDERS_DB_PASSWORD.
 */
export interface BundleSecrets {
  envFileContent: string;
  containerEnv: Map<string, Record<string, string>>;
  credentials: BundleCredential[];
}

export interface BundleCredential {
  serviceName: string;
  kind: "postgres" | "mysql" | "mongo" | "minio";
  user: string;
  passwordVar: string;
}

export function generateSecrets(
  design: DesignJSON,
  serviceNameByNodeId: Map<string, string>,
): BundleSecrets {
  const lines: string[] = ["# Auto-generated. Edit at your own risk.", ""];
  const containerEnv = new Map<string, Record<string, string>>();
  const credentials: BundleCredential[] = [];

  for (const node of design.nodes) {
    if (node.type !== "system") continue;
    const data = node.data as SystemNodeData;
    const name = serviceNameByNodeId.get(node.id);
    if (!name) continue;

    const upper = name.replace(/-/g, "_").toUpperCase();
    const techId = resolveTechId(data.componentType, data.plan?.technology ?? "", "docker");

    if (data.componentType === "database" && isPostgresLike(techId)) {
      const password = randomSecret();
      const varName = `${upper}_PASSWORD`;
      lines.push(`${varName}=${password}`);
      containerEnv.set(node.id, {
        POSTGRES_DB: data.plan?.database || "app",
        POSTGRES_USER: "admin",
        POSTGRES_PASSWORD: `\${${varName}}`,
      });
      credentials.push({
        serviceName: name,
        kind: "postgres",
        user: "admin",
        passwordVar: varName,
      });
    } else if (data.componentType === "database" && isMysqlLike(techId)) {
      const password = randomSecret();
      const varName = `${upper}_PASSWORD`;
      lines.push(`${varName}=${password}`);
      containerEnv.set(node.id, {
        MYSQL_DATABASE: data.plan?.database || "app",
        MYSQL_ROOT_PASSWORD: `\${${varName}}`,
      });
      credentials.push({ serviceName: name, kind: "mysql", user: "root", passwordVar: varName });
    } else if (data.componentType === "database" && techId === "mongodb") {
      // MongoDB community image runs without auth by default; skip a password
      // for now and let users layer it on. Still emit a placeholder for future use.
      containerEnv.set(node.id, {
        MONGO_INITDB_DATABASE: data.plan?.database || "app",
      });
    } else if (data.componentType === "storage" && (techId === "s3" || techId === "minio")) {
      const user = randomSecret(12);
      const password = randomSecret();
      const userVar = `${upper}_ROOT_USER`;
      const passVar = `${upper}_ROOT_PASSWORD`;
      lines.push(`${userVar}=${user}`);
      lines.push(`${passVar}=${password}`);
      containerEnv.set(node.id, {
        MINIO_ROOT_USER: `\${${userVar}}`,
        MINIO_ROOT_PASSWORD: `\${${passVar}}`,
      });
      credentials.push({
        serviceName: name,
        kind: "minio",
        user: "<see .env>",
        passwordVar: passVar,
      });
    }
  }

  return {
    envFileContent: lines.join("\n") + "\n",
    containerEnv,
    credentials,
  };
}

function isPostgresLike(techId: string): boolean {
  return techId === "postgresql" || techId === "cockroachdb" || techId === "aurora";
}

function isMysqlLike(techId: string): boolean {
  return techId === "mysql" || techId === "mariadb";
}

/** URL-safe base64-ish secret derived from crypto.getRandomValues. */
function randomSecret(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  // Base64url without padding, since some env parsers choke on `=`.
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
