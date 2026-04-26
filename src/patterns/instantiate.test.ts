import { describe, it, expect } from "vitest";
import { instantiatePattern } from "./instantiate";
import type { ComponentType } from "../types";
import { BUILTIN_PATTERNS } from "./builtin-patterns";

let counter = 0;
function generateLabel(type: ComponentType): string {
  return `${type}-${++counter}`;
}

describe("instantiatePattern", () => {
  it("returns empty arrays for an unknown pattern ID", () => {
    const { nodes, edges } = instantiatePattern("nonexistent", { x: 0, y: 0 }, generateLabel);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  describe("container-wrapped mode (no anchor)", () => {
    it("creates a container node plus child nodes for cache-aside", () => {
      counter = 0;
      const { nodes, edges } = instantiatePattern("cache-aside", { x: 500, y: 500 }, generateLabel);
      // cache-aside has 3 pattern nodes → container + 3 children
      expect(nodes).toHaveLength(4);
      expect(nodes[0].type).toBe("container");
      expect(nodes[0].data.label).toBe("Cache-Aside");
      // Children should reference the container as parent
      for (const child of nodes.slice(1)) {
        expect(child.type).toBe("system");
        expect(child.parentId).toBe(nodes[0].id);
      }
      // Should produce 2 edges (svc→cache, svc→db)
      expect(edges).toHaveLength(2);
    });

    it("generates unique IDs for every node and edge", () => {
      counter = 0;
      const { nodes, edges } = instantiatePattern("cqrs", { x: 0, y: 0 }, generateLabel);
      const allNodeIds = nodes.map((n) => n.id);
      const allEdgeIds = edges.map((e) => e.id);
      expect(new Set(allNodeIds).size).toBe(allNodeIds.length);
      expect(new Set(allEdgeIds).size).toBe(allEdgeIds.length);
    });

    it("gives each child the correct component type", () => {
      counter = 0;
      const { nodes } = instantiatePattern("cache-aside", { x: 500, y: 500 }, generateLabel);
      const children = nodes.slice(1); // skip container
      const types = children.map((n) => (n.data as { componentType: string }).componentType);
      expect(types).toContain("service");
      expect(types).toContain("cache");
      expect(types).toContain("database");
    });

    it("calls generateLabel for each child node", () => {
      counter = 0;
      const { nodes } = instantiatePattern("cache-aside", { x: 0, y: 0 }, generateLabel);
      const children = nodes.slice(1);
      const labels = children.map((n) => (n.data as { label: string }).label);
      // Labels should use the generateLabel function
      expect(labels).toEqual(expect.arrayContaining(["service-1", "cache-2", "database-3"]));
    });

    it("edges reference valid node IDs", () => {
      counter = 0;
      const { nodes, edges } = instantiatePattern("cache-aside", { x: 0, y: 0 }, generateLabel);
      const nodeIds = new Set(nodes.map((n) => n.id));
      for (const edge of edges) {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      }
    });

    it("edges carry label, protocol, and format from the pattern definition", () => {
      counter = 0;
      const { edges } = instantiatePattern("cache-aside", { x: 0, y: 0 }, generateLabel);
      const labels = edges.map((e) => (e.data as { label: string }).label);
      expect(labels).toContain("check");
      expect(labels).toContain("fallback");
    });

    it("container has the pattern color with low alpha", () => {
      counter = 0;
      const { nodes } = instantiatePattern("cache-aside", { x: 0, y: 0 }, generateLabel);
      const container = nodes[0];
      // Pattern color is #a855f7, container should have it with "10" appended
      expect((container.data as { color: string }).color).toBe("#a855f710");
    });
  });

  describe("anchor mode", () => {
    it("reuses the anchor node ID instead of creating a new node", () => {
      counter = 0;
      const anchor = {
        id: "existing-svc",
        componentType: "service" as ComponentType,
        position: { x: 200, y: 200 },
      };
      const { nodes } = instantiatePattern("cache-aside", { x: 0, y: 0 }, generateLabel, anchor);
      // Should create only 2 new nodes (cache and database), not the service
      expect(nodes).toHaveLength(2);
      const nodeIds = nodes.map((n) => n.id);
      expect(nodeIds).not.toContain("existing-svc");
    });

    it("does not create a container in anchor mode", () => {
      counter = 0;
      const anchor = {
        id: "existing-svc",
        componentType: "service" as ComponentType,
        position: { x: 200, y: 200 },
      };
      const { nodes } = instantiatePattern("cache-aside", { x: 0, y: 0 }, generateLabel, anchor);
      expect(nodes.every((n) => n.type === "system")).toBe(true);
    });

    it("edges connect to the anchor ID", () => {
      counter = 0;
      const anchor = {
        id: "existing-svc",
        componentType: "service" as ComponentType,
        position: { x: 200, y: 200 },
      };
      const { edges } = instantiatePattern("cache-aside", { x: 0, y: 0 }, generateLabel, anchor);
      // Both edges should source from the anchor
      const sources = edges.map((e) => e.source);
      expect(sources.every((s) => s === "existing-svc")).toBe(true);
    });
  });

  describe("all builtin patterns", () => {
    for (const pattern of BUILTIN_PATTERNS) {
      it(`${pattern.id} produces valid nodes and edges`, () => {
        counter = 0;
        const { nodes, edges } = instantiatePattern(pattern.id, { x: 0, y: 0 }, generateLabel);
        // Container + children
        expect(nodes.length).toBe(pattern.nodes.length + 1);
        expect(edges.length).toBe(pattern.edges.length);

        const nodeIds = new Set(nodes.map((n) => n.id));
        for (const edge of edges) {
          expect(nodeIds.has(edge.source)).toBe(true);
          expect(nodeIds.has(edge.target)).toBe(true);
        }
      });
    }
  });
});
