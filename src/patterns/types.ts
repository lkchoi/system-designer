import type { ComponentType, EdgeProtocol, EdgeFormat } from "../types";

export interface PatternNode {
  localId: string;
  componentType: ComponentType;
  relativePosition: { x: number; y: number };
}

export interface PatternEdge {
  sourceLocalId: string;
  targetLocalId: string;
  label?: string;
  protocol?: EdgeProtocol;
  format?: EdgeFormat;
}

export interface PatternDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  source: "builtin" | "custom";
  nodes: PatternNode[];
  edges: PatternEdge[];
}
