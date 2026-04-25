import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData } from "../types";

/**
 * Build an OAS3 YAML string from API Gateway nodes in the design.
 * Returns null when no gateways have endpoints.
 */
export function buildOpenApiYaml(design: DesignJSON): string | null {
  const gateways = design.nodes.filter(
    (n) => (n.data as SystemNodeData).componentType === "api-gateway",
  );

  const RESPONSE_DESCRIPTIONS: Record<number, string> = {
    200: "OK",
    201: "Created",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
    503: "Service Unavailable",
  };

  const paths: Record<string, Record<string, unknown>> = {};

  for (const gw of gateways) {
    const data = gw.data as SystemNodeData;
    const endpoints = data.endpoints ?? [];
    const gwLabel = data.label || "API Gateway";

    for (const ep of endpoints) {
      if (!ep.path) continue;
      const method = ep.method.toLowerCase();
      const path = ep.path.startsWith("/") ? ep.path : `/${ep.path}`;
      if (!paths[path]) paths[path] = {};

      // Response codes: use endpoint-level selection, or fall back to defaults
      let codes: number[];
      if (ep.responseCodes && ep.responseCodes.length > 0) {
        codes = ep.responseCodes;
      } else {
        codes = [200, 400, 401, 403, 404, 500];
        if (method === "post" || method === "put") codes.push(409, 422);
        if (method === "delete") codes.push(204);
      }
      const responses: Record<string, { description: string }> = {};
      for (const code of codes.sort((a, b) => a - b)) {
        responses[String(code)] = { description: RESPONSE_DESCRIPTIONS[code] ?? "Response" };
      }

      const operation: Record<string, unknown> = {
        summary: `${ep.method} ${path} (${gwLabel})`,
        responses,
      };

      // Query parameters
      const queryParams = (ep.queryParams ?? []).filter((q) => q.name.trim());
      if (queryParams.length > 0) {
        operation.parameters = queryParams.map((q) => ({
          name: q.name,
          in: "query",
          required: q.required,
          schema: { type: "string" },
        }));
      }

      paths[path][method] = operation;
    }
  }

  if (Object.keys(paths).length === 0) return null;

  const spec = {
    openapi: "3.0.3",
    info: {
      title: design.name,
      version: "1.0.0",
    },
    paths,
  };

  return toYaml(spec);
}

export const openapiConverter: ConverterModule = {
  id: "openapi",
  label: "OpenAPI 3.0",
  description: "OAS3 spec from API Gateway endpoints",
  category: "api",
  fileExtensions: [".yaml", ".yml"],
  canImport: false,

  exportDesign(design: DesignJSON) {
    const yaml = buildOpenApiYaml(design) ?? toYaml({ openapi: "3.0.3", info: { title: design.name, version: "1.0.0" }, paths: {} });
    return {
      content: yaml,
      filename: `${design.name}-openapi.yaml`,
      mimeType: "application/x-yaml",
    };
  },
};

function toYaml(obj: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (obj === null || obj === undefined) return `${pad}null\n`;
  if (typeof obj === "boolean") return `${pad}${obj}\n`;
  if (typeof obj === "number") return `${pad}${obj}\n`;
  if (typeof obj === "string") {
    if (
      obj.includes(":") ||
      obj.includes("#") ||
      obj.includes("'") ||
      obj.includes('"') ||
      obj.includes("{") ||
      obj.includes("}") ||
      obj.includes("[") ||
      obj.includes("]") ||
      /^\s|\s$/.test(obj)
    ) {
      return `${pad}"${obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"\n`;
    }
    return `${pad}${obj}\n`;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return `${pad}[]\n`;
    let out = "";
    for (const item of obj) {
      if (typeof item === "object" && item !== null) {
        out += `${pad}-\n${toYaml(item, indent + 1)}`;
      } else {
        out += `${pad}- ${String(item)}\n`;
      }
    }
    return out;
  }

  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return `${pad}{}\n`;
    let out = "";
    for (const [key, val] of entries) {
      if (typeof val === "object" && val !== null) {
        out += `${pad}${key}:\n${toYaml(val, indent + 1)}`;
      } else {
        out += `${pad}${key}: ${toYaml(val, 0).trim()}\n`;
      }
    }
    return out;
  }

  return `${pad}${String(obj)}\n`;
}
