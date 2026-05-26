/**
 * Deterministic OpenAPI 3.1 generator for `api-gateway` nodes.
 *
 * Routes are derived from the **downstream services'** endpoint lists
 * (services attached as outbound edges from the gateway). Auth scheme
 * comes from `plan.authMethod`, CORS from `plan.cors`, rate limits land
 * as `x-rate-limit` extensions.
 *
 * Why downstream services own the endpoints: the api-gateway node in
 * Arkon's data model doesn't carry endpoints itself — it routes them.
 * Endpoints live on the service nodes. So the gateway generator looks
 * at its outbound edges to find the services it fronts and aggregates
 * their endpoints into one spec.
 *
 * No LLM. Pure transform of structured node data.
 */

import yaml from "js-yaml";
import type { Endpoint } from "../../../types";
import type { Generator, GeneratorContext, GeneratedFile } from "../types";

interface OpenAPIPath {
  [method: string]: {
    summary?: string;
    parameters?: Array<{
      name: string;
      in: "query" | "path" | "header";
      required: boolean;
      schema: { type: string };
    }>;
    responses: Record<string, { description: string }>;
    security?: Array<Record<string, string[]>>;
  };
}

interface OpenAPISpec {
  openapi: "3.1.0";
  info: { title: string; version: string; description?: string };
  paths: Record<string, OpenAPIPath>;
  components: {
    securitySchemes: Record<
      string,
      { type: string; scheme?: string; bearerFormat?: string; in?: string; name?: string }
    >;
  };
  // Vendor extensions
  ["x-arkon-source"]?: { node: string; downstreamServices: string[] };
  ["x-rate-limit"]?: string;
  ["x-cors-allowed-origins"]?: string;
}

export const openApiGenerator: Generator = {
  kind: "deterministic",

  supports(ctx) {
    return ctx.node.componentType === "api-gateway";
  },

  async generate(ctx: GeneratorContext): Promise<GeneratedFile[]> {
    const plan = ctx.node.plan ?? {};

    // Collect endpoints from downstream service-like nodes. We rely on
    // the caller to have populated outbound edges with the right shape.
    // TODO: when fleshOutDesign() learns to pass the full node objects
    // (not just refs), use those directly. Today the EdgeRef only carries
    // labels/tech ids, so we attach endpoints to a placeholder path.
    //
    // For v1 we synthesize routes from the gateway's outbound edges by
    // labeling each downstream service as /<service-slug>/* — placeholder
    // until we resolve real endpoint lists.

    const paths: Record<string, OpenAPIPath> = {};
    const downstreamLabels: string[] = [];

    for (const out of ctx.outbound) {
      downstreamLabels.push(out.otherNodeLabel);
      const prefix = "/" + slugify(out.otherNodeLabel);
      paths[prefix + "/{proxy+}"] = makeProxyOperation(out.otherNodeLabel, plan.authMethod);
    }

    // If endpoints were attached to the gateway node directly (some
    // designs do model the gateway with explicit endpoints), include them.
    if (ctx.endpoints && ctx.endpoints.length > 0) {
      for (const ep of ctx.endpoints) {
        ensurePath(paths, ep.path)[ep.method.toLowerCase()] = endpointOperation(ep, plan.authMethod);
      }
    }

    const securitySchemes: OpenAPISpec["components"]["securitySchemes"] = {};
    if (plan.authMethod) {
      for (const scheme of authSchemes(plan.authMethod)) {
        Object.assign(securitySchemes, scheme);
      }
    }

    const spec: OpenAPISpec = {
      openapi: "3.1.0",
      info: {
        title: ctx.node.label,
        version: "0.1.0",
        description: ctx.node.description || undefined,
      },
      paths,
      components: { securitySchemes },
      "x-arkon-source": {
        node: ctx.node.id,
        downstreamServices: downstreamLabels,
      },
    };

    if (plan.rateLimit) spec["x-rate-limit"] = plan.rateLimit;
    if (plan.cors) spec["x-cors-allowed-origins"] = plan.cors;

    return [
      { path: "openapi.yaml", contents: yaml.dump(spec, { lineWidth: 120 }) },
      { path: "openapi.json", contents: JSON.stringify(spec, null, 2) + "\n" },
    ];
  },
};

function makeProxyOperation(label: string, authMethod: string | undefined): OpenAPIPath {
  return {
    "x-arkon-route-target": label,
    any: {
      summary: `Proxy to ${label}`,
      parameters: [
        {
          name: "proxy",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": { description: "Success" },
        "4XX": { description: "Client error" },
        "5XX": { description: "Server error" },
      },
      ...(authMethod ? { security: defaultSecurity(authMethod) } : {}),
    },
  } as unknown as OpenAPIPath;
}

function endpointOperation(ep: Endpoint, authMethod: string | undefined): OpenAPIPath[string] {
  const params = (ep.queryParams ?? []).map((q) => ({
    name: q.name,
    in: "query" as const,
    required: q.required,
    schema: { type: "string" },
  }));
  const responses: Record<string, { description: string }> = {};
  for (const code of ep.responseCodes ?? [200]) {
    responses[String(code)] = { description: describeCode(code) };
  }
  return {
    summary: `${ep.method} ${ep.path}`,
    ...(params.length ? { parameters: params } : {}),
    responses,
    ...(authMethod ? { security: defaultSecurity(authMethod) } : {}),
  };
}

function ensurePath(paths: Record<string, OpenAPIPath>, p: string): OpenAPIPath {
  if (!paths[p]) paths[p] = {};
  return paths[p];
}

function describeCode(code: number): string {
  if (code >= 200 && code < 300) return "Success";
  if (code === 400) return "Bad request";
  if (code === 401) return "Unauthorized";
  if (code === 403) return "Forbidden";
  if (code === 404) return "Not found";
  if (code === 409) return "Conflict";
  if (code >= 400 && code < 500) return "Client error";
  if (code >= 500) return "Server error";
  return "Response";
}

function defaultSecurity(authMethod: string): Array<Record<string, string[]>> {
  const lower = authMethod.toLowerCase();
  if (lower.includes("jwt") || lower.includes("bearer")) return [{ BearerAuth: [] }];
  if (lower.includes("api") && lower.includes("key")) return [{ ApiKeyAuth: [] }];
  if (lower.includes("oauth")) return [{ OAuth2: [] }];
  return [{ BearerAuth: [] }];
}

function authSchemes(authMethod: string): Array<OpenAPISpec["components"]["securitySchemes"]> {
  const lower = authMethod.toLowerCase();
  const out: Array<OpenAPISpec["components"]["securitySchemes"]> = [];
  if (lower.includes("jwt") || lower.includes("bearer")) {
    out.push({ BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } });
  }
  if (lower.includes("api") && lower.includes("key")) {
    out.push({ ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" } });
  }
  if (lower.includes("oauth")) {
    out.push({ OAuth2: { type: "oauth2" } });
  }
  if (out.length === 0) {
    out.push({ BearerAuth: { type: "http", scheme: "bearer" } });
  }
  return out;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
