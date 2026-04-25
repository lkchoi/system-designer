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

  const paths: Record<
    string,
    Record<string, { summary: string; responses: Record<string, { description: string }> }>
  > = {};

  for (const gw of gateways) {
    const data = gw.data as SystemNodeData;
    const endpoints = data.endpoints ?? [];
    const gwLabel = data.label || "API Gateway";

    for (const ep of endpoints) {
      if (!ep.path) continue;
      const method = ep.method.toLowerCase();
      const path = ep.path.startsWith("/") ? ep.path : `/${ep.path}`;
      if (!paths[path]) paths[path] = {};
      const responses: Record<string, { description: string }> = {
        "200": { description: "OK" },
        "400": { description: "Bad Request" },
        "401": { description: "Unauthorized" },
        "403": { description: "Forbidden" },
        "404": { description: "Not Found" },
        "500": { description: "Internal Server Error" },
      };
      if (method === "post" || method === "put") {
        responses["409"] = { description: "Conflict" };
        responses["422"] = { description: "Unprocessable Entity" };
      }
      if (method === "delete") {
        responses["204"] = { description: "No Content" };
      }
      paths[path][method] = {
        summary: `${ep.method} ${path} (${gwLabel})`,
        responses,
      };
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
