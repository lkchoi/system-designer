import { describe, it, expect, beforeEach } from "vitest";
import type { ComponentRegistryEntry } from "./types";

// Registry uses localStorage — stub it before importing
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  },
});

const { registry } = await import(".");

beforeEach(() => {
  storage.clear();
});

describe("getBuiltins", () => {
  it("returns all builtin entries", () => {
    const builtins = registry.getBuiltins();
    expect(builtins.length).toBeGreaterThan(0);
    expect(builtins.every((e) => e.source === "builtin")).toBe(true);
  });

  it("includes expected component types", () => {
    const ids = registry.getBuiltins().map((e) => e.id);
    expect(ids).toContain("database");
    expect(ids).toContain("api-gateway");
    expect(ids).toContain("service");
    expect(ids).toContain("cache");
    expect(ids).toContain("dns");
  });
});

describe("get", () => {
  it("returns entry by id", () => {
    const entry = registry.get("database");
    expect(entry).toBeDefined();
    expect(entry!.label).toBe("Database");
  });

  it("returns undefined for unknown id", () => {
    expect(registry.get("nonexistent")).toBeUndefined();
  });
});

describe("canConnect", () => {
  it("returns false for unknown types", () => {
    expect(registry.canConnect("nonexistent", "database")).toBe(false);
    expect(registry.canConnect("database", "nonexistent")).toBe(false);
  });

  it("allows connection when source declares target", () => {
    // service.connectsTo includes database
    expect(registry.canConnect("service", "database")).toBe(true);
  });

  it("allows connection in reverse (bidirectional)", () => {
    // database.connectsTo does not include service, but service.connectsTo includes database
    expect(registry.canConnect("database", "service")).toBe(true);
  });

  it("allows connection when target has empty connectsTo (unrestricted)", () => {
    // cache.connectsTo is [], so anything can connect to cache
    expect(registry.canConnect("api-gateway", "cache")).toBe(true);
  });

  it("blocks connection when neither side declares the other", () => {
    // cron.connectsTo = [service, serverless, api-gateway, ...], not client
    // client.connectsTo = [api-gateway, cdn, load-balancer, dns, firewall], not cron
    expect(registry.canConnect("cron", "client")).toBe(false);
  });

  it("allows self-connections when declared", () => {
    // api-gateway.connectsTo includes api-gateway (federation)
    expect(registry.canConnect("api-gateway", "api-gateway")).toBe(true);
  });
});

describe("register / unregister", () => {
  const custom: ComponentRegistryEntry = {
    id: "test-custom",
    label: "Test Custom",
    color: "#000",
    icon: "M0 0",
    category: "compute",
    planFields: [],
    technologies: [],
    connectsTo: [],
    source: "builtin", // will be overridden to custom
  };

  it("registers a custom entry", () => {
    registry.register(custom);
    const entry = registry.get("test-custom");
    expect(entry).toBeDefined();
    expect(entry!.source).toBe("custom");
    // cleanup
    registry.unregister("test-custom");
  });

  it("cannot unregister builtin entries", () => {
    expect(registry.unregister("database")).toBe(false);
  });

  it("can unregister custom entries", () => {
    registry.register(custom);
    expect(registry.unregister("test-custom")).toBe(true);
    expect(registry.get("test-custom")).toBeUndefined();
  });
});
