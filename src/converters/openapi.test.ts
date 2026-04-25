import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData, Endpoint } from "../types";
import { buildOpenApiYaml, openapiConverter } from "./openapi";

function makeNode(
  id: string,
  componentType: SystemNodeData["componentType"],
  overrides: Partial<SystemNodeData> = {},
): Node<SystemNodeData> {
  return {
    id,
    type: "system",
    position: { x: 0, y: 0 },
    data: {
      label: id,
      description: "",
      componentType,
      status: "healthy",
      metrics: { cpu: 0, memory: 0, requestsPerSec: 0, latency: 0 },
      plan: {},
      sharded: false,
      shardKey: "",
      endpoints: [],
      links: [],
      capClassification: "",
      stressFailure: "none",
      capacityPercent: 50,
      consumerRate: 0,
      ...overrides,
    },
  };
}

function designWith(
  nodes: Node<SystemNodeData>[],
  name = "TestDesign",
): DesignJSON {
  return {
    version: 1,
    name,
    nodes: nodes as unknown as DesignJSON["nodes"],
    edges: [] as unknown as DesignJSON["edges"],
    viewport: { x: 0, y: 0, zoom: 1 },
    flowPaths: [],
  };
}

function ep(
  method: string,
  path: string,
  opts: Partial<Endpoint> = {},
): Endpoint {
  return { id: `ep-${method}-${path}`, method, path, ...opts };
}

describe("buildOpenApiYaml", () => {
  it("returns null when no api-gateway nodes exist", () => {
    const svc = makeNode("svc", "service");
    expect(buildOpenApiYaml(designWith([svc]))).toBeNull();
  });

  it("returns null when api-gateway has no endpoints", () => {
    const gw = makeNode("gw", "api-gateway");
    expect(buildOpenApiYaml(designWith([gw]))).toBeNull();
  });

  it("generates valid YAML with a single endpoint", () => {
    const gw = makeNode("gw", "api-gateway", {
      label: "Gateway",
      endpoints: [ep("GET", "/users")],
    });
    const yaml = buildOpenApiYaml(designWith([gw]))!;

    expect(yaml).toContain("openapi: 3.0.3");
    expect(yaml).toContain("/users:");
    expect(yaml).toContain("get:");
    expect(yaml).toContain("summary: GET /users (Gateway)");
    expect(yaml).toContain("200:");
    expect(yaml).toContain("500:");
  });

  it("prepends / to paths that don't start with one", () => {
    const gw = makeNode("gw", "api-gateway", {
      endpoints: [ep("GET", "items")],
    });
    const yaml = buildOpenApiYaml(designWith([gw]))!;

    expect(yaml).toContain("/items:");
    expect(yaml).not.toMatch(/^\s+items:/m);
  });

  it("uses endpoint-level responseCodes when provided", () => {
    const gw = makeNode("gw", "api-gateway", {
      endpoints: [ep("POST", "/orders", { responseCodes: [201, 400] })],
    });
    const yaml = buildOpenApiYaml(designWith([gw]))!;

    expect(yaml).toContain("201:");
    expect(yaml).toContain("400:");
    // should not include defaults that were not specified
    expect(yaml).not.toContain("409:");
    expect(yaml).not.toContain("422:");
    expect(yaml).not.toContain("500:");
  });

  it("falls back to default codes for POST (includes 409, 422)", () => {
    const gw = makeNode("gw", "api-gateway", {
      endpoints: [ep("POST", "/orders")],
    });
    const yaml = buildOpenApiYaml(designWith([gw]))!;

    expect(yaml).toContain("200:");
    expect(yaml).toContain("409:");
    expect(yaml).toContain("422:");
    expect(yaml).toContain("500:");
  });

  it("falls back to default codes for DELETE (includes 204)", () => {
    const gw = makeNode("gw", "api-gateway", {
      endpoints: [ep("DELETE", "/orders/1")],
    });
    const yaml = buildOpenApiYaml(designWith([gw]))!;

    expect(yaml).toContain("204:");
    expect(yaml).toContain("200:");
  });

  it("falls back to defaults when responseCodes is empty", () => {
    const gw = makeNode("gw", "api-gateway", {
      endpoints: [ep("PUT", "/items/1", { responseCodes: [] })],
    });
    const yaml = buildOpenApiYaml(designWith([gw]))!;

    expect(yaml).toContain("409:");
    expect(yaml).toContain("422:");
  });

  it("includes query parameters when present", () => {
    const gw = makeNode("gw", "api-gateway", {
      endpoints: [
        ep("GET", "/search", {
          queryParams: [
            { name: "q", required: true },
            { name: "page", required: false },
          ],
        }),
      ],
    });
    const yaml = buildOpenApiYaml(designWith([gw]))!;

    expect(yaml).toContain("parameters:");
    expect(yaml).toContain("name: q");
    expect(yaml).toContain("required: true");
    expect(yaml).toContain("name: page");
    expect(yaml).toContain("required: false");
    expect(yaml).toContain('in: query');
  });

  it("omits parameters when queryParams have blank names", () => {
    const gw = makeNode("gw", "api-gateway", {
      endpoints: [
        ep("GET", "/data", {
          queryParams: [{ name: "  ", required: false }],
        }),
      ],
    });
    const yaml = buildOpenApiYaml(designWith([gw]))!;

    expect(yaml).not.toContain("parameters:");
  });

  it("merges endpoints from multiple gateways into one paths object", () => {
    const gw1 = makeNode("gw1", "api-gateway", {
      label: "Public",
      endpoints: [ep("GET", "/users")],
    });
    const gw2 = makeNode("gw2", "api-gateway", {
      label: "Internal",
      endpoints: [ep("POST", "/admin/reset")],
    });
    const yaml = buildOpenApiYaml(designWith([gw1, gw2]))!;

    expect(yaml).toContain("/users:");
    expect(yaml).toContain("GET /users (Public)");
    expect(yaml).toContain("/admin/reset:");
    expect(yaml).toContain("POST /admin/reset (Internal)");
  });

  it("merges different methods on the same path", () => {
    const gw = makeNode("gw", "api-gateway", {
      endpoints: [ep("GET", "/items"), ep("POST", "/items")],
    });
    const yaml = buildOpenApiYaml(designWith([gw]))!;

    expect(yaml).toContain("get:");
    expect(yaml).toContain("post:");
    // /items: should appear only once
    const pathOccurrences = yaml.split("/items:").length - 1;
    expect(pathOccurrences).toBe(1);
  });
});

describe("openapiConverter.exportDesign", () => {
  it("returns content with the design name in the info title", () => {
    const gw = makeNode("gw", "api-gateway", {
      endpoints: [ep("GET", "/health")],
    });
    const result = openapiConverter.exportDesign!(designWith([gw], "MyService"));

    expect(result.content).toContain("title: MyService");
    expect(result.filename).toBe("MyService-openapi.yaml");
    expect(result.mimeType).toBe("application/x-yaml");
  });

  it("returns a stub spec when no endpoints exist", () => {
    const svc = makeNode("svc", "service");
    const result = openapiConverter.exportDesign!(designWith([svc], "Empty"));

    expect(result.content).toContain("openapi: 3.0.3");
    expect(result.content).toContain("title: Empty");
    // empty object is rendered on its own indented line
    expect(result.content).toMatch(/paths:\n\s+\{\}/);
  });
});

describe("toYaml (via buildOpenApiYaml)", () => {
  it("quotes strings with special characters", () => {
    const gw = makeNode("gw", "api-gateway", {
      label: 'GW: main # "primary"',
      endpoints: [ep("GET", "/test")],
    });
    const yaml = buildOpenApiYaml(designWith([gw]))!;

    // The summary value contains : # and " so the whole string gets quoted
    expect(yaml).toMatch(/summary: "GET \/test \(GW: main # \\"primary\\"\)"/);
  });

  it("renders empty objects as {}", () => {
    const svc = makeNode("svc", "service");
    const result = openapiConverter.exportDesign!(designWith([svc]));
    // paths is an empty object rendered on its own line
    expect(result.content).toMatch(/paths:\n\s+\{\}/);
  });

  it("renders boolean and number values correctly", () => {
    const gw = makeNode("gw", "api-gateway", {
      endpoints: [
        ep("GET", "/q", {
          queryParams: [{ name: "active", required: true }],
        }),
      ],
    });
    const yaml = buildOpenApiYaml(designWith([gw]))!;

    // required: true is a boolean
    expect(yaml).toContain("required: true");
    // schema type is string
    expect(yaml).toContain("type: string");
  });

  it("handles strings with braces", () => {
    const gw = makeNode("gw", "api-gateway", {
      label: "GW {v1}",
      endpoints: [ep("GET", "/x")],
    });
    const yaml = buildOpenApiYaml(designWith([gw]))!;

    expect(yaml).toMatch(/"GET \/x \(GW \{v1\}\)"/);
  });
});
