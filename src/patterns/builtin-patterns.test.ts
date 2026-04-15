import { describe, it, expect } from "vitest";
import { BUILTIN_PATTERNS } from "./builtin-patterns";

// Stub localStorage for registry import
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  },
});

const { registry } = await import("../registry");

describe("builtin patterns", () => {
  it("has unique ids", () => {
    const ids = BUILTIN_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has required fields on every pattern", () => {
    for (const pattern of BUILTIN_PATTERNS) {
      expect(pattern.name).toBeTruthy();
      expect(pattern.description).toBeTruthy();
      expect(pattern.icon).toBeTruthy();
      expect(pattern.color).toMatch(/^#/);
      expect(pattern.nodes.length).toBeGreaterThan(0);
      expect(pattern.edges.length).toBeGreaterThan(0);
    }
  });

  it("uses only valid component types in nodes", () => {
    for (const pattern of BUILTIN_PATTERNS) {
      for (const node of pattern.nodes) {
        const entry = registry.get(node.componentType);
        expect(
          entry,
          `${pattern.id}: unknown component type "${node.componentType}"`,
        ).toBeDefined();
      }
    }
  });

  it("has unique localIds within each pattern", () => {
    for (const pattern of BUILTIN_PATTERNS) {
      const localIds = pattern.nodes.map((n) => n.localId);
      expect(new Set(localIds).size, `${pattern.id}: duplicate localIds`).toBe(localIds.length);
    }
  });

  it("references only declared localIds in edges", () => {
    for (const pattern of BUILTIN_PATTERNS) {
      const localIds = new Set(pattern.nodes.map((n) => n.localId));
      for (const edge of pattern.edges) {
        expect(
          localIds.has(edge.sourceLocalId),
          `${pattern.id}: edge references unknown source "${edge.sourceLocalId}"`,
        ).toBe(true);
        expect(
          localIds.has(edge.targetLocalId),
          `${pattern.id}: edge references unknown target "${edge.targetLocalId}"`,
        ).toBe(true);
      }
    }
  });

  it("has valid connections per registry rules", () => {
    for (const pattern of BUILTIN_PATTERNS) {
      const nodeMap = new Map(pattern.nodes.map((n) => [n.localId, n.componentType]));
      for (const edge of pattern.edges) {
        const sourceType = nodeMap.get(edge.sourceLocalId)!;
        const targetType = nodeMap.get(edge.targetLocalId)!;
        expect(
          registry.canConnect(sourceType, targetType),
          `${pattern.id}: ${sourceType} -> ${targetType} is not allowed`,
        ).toBe(true);
      }
    }
  });
});
