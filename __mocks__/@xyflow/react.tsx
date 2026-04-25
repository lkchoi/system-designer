import { vi } from "vitest";
import type { ReactNode } from "react";

export const Position = {
  Top: "top",
  Right: "right",
  Bottom: "bottom",
  Left: "left",
} as const;

export const ConnectionMode = { Loose: "loose", Strict: "strict" } as const;
export const BackgroundVariant = { Dots: "dots", Lines: "lines", Cross: "cross" } as const;

const mockReactFlowValue = {
  deleteElements: vi.fn(),
  updateNodeData: vi.fn(),
  setNodes: vi.fn(),
  getNodes: vi.fn(() => []),
  getEdges: vi.fn(() => []),
  screenToFlowPosition: vi.fn((pos: { x: number; y: number }) => pos),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  fitView: vi.fn(),
  getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  setViewport: vi.fn(),
};

export function useReactFlow() {
  return mockReactFlowValue;
}

export function ReactFlowProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function ReactFlow({ children }: { children?: ReactNode }) {
  return <div data-testid="reactflow">{children}</div>;
}

export function Handle() {
  return null;
}

export function NodeResizer() {
  return null;
}

export function MiniMap() {
  return null;
}

export function Background() {
  return null;
}

export function BaseEdge({ id }: { id: string }) {
  return <g data-testid={`base-edge-${id}`} />;
}

export function EdgeLabelRenderer({ children }: { children: ReactNode }) {
  return <div data-testid="edge-label-renderer">{children}</div>;
}

export function getBezierPath() {
  return ["M0,0 C10,10 20,20 30,30", 150, 75] as const;
}

export function applyNodeChanges(changes: unknown[], nodes: unknown[]) {
  return nodes;
}

export function applyEdgeChanges(changes: unknown[], edges: unknown[]) {
  return edges;
}

export function addEdge(edge: unknown, edges: unknown[]) {
  return edges;
}

export { mockReactFlowValue as __mockReactFlow };
