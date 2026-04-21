import type { Node, Edge } from "@xyflow/react";
import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";
import type { SystemNodeData, ContainerNodeData, StickyNoteData, TextNodeData } from "../types";
import { registry } from "../registry";

// Excalidraw element types
interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  groupIds: string[];
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: { id: string; type: string }[] | null;
  updated: number;
  link: null;
  locked: boolean;
  [key: string]: unknown;
}

interface ExcalidrawTextElement extends ExcalidrawElement {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign: string;
  verticalAlign: string;
  containerId: string | null;
  originalText: string;
  autoResize: boolean;
}

interface ExcalidrawArrowElement extends ExcalidrawElement {
  type: "arrow";
  points: [number, number][];
  startBinding: { elementId: string; focus: number; gap: number } | null;
  endBinding: { elementId: string; focus: number; gap: number } | null;
  startArrowhead: null;
  endArrowhead: string;
}

const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 50;

function makeSeed(): number {
  return Math.floor(Math.random() * 2000000000);
}

function baseElement(
  id: string,
  type: string,
  x: number,
  y: number,
  width: number,
  height: number,
): ExcalidrawElement {
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    roundness: { type: 3 },
    seed: makeSeed(),
    version: 1,
    versionNonce: makeSeed(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function absolutePosition(node: Node, nodesById: Map<string, Node>): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let current = node;
  while (current.parentId) {
    const parent = nodesById.get(current.parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    current = parent;
  }
  return { x, y };
}

function nodeWidth(node: Node): number {
  return (node.style?.width as number) ?? (node.measured?.width as number) ?? DEFAULT_WIDTH;
}

function nodeHeight(node: Node): number {
  return (node.style?.height as number) ?? (node.measured?.height as number) ?? DEFAULT_HEIGHT;
}

// Export: convert DesignJSON to Excalidraw JSON
function exportToExcalidraw(design: DesignJSON): string {
  const elements: ExcalidrawElement[] = [];
  const nodesById = new Map(design.nodes.map((n) => [n.id, n]));

  for (const node of design.nodes) {
    if (node.type === "system") {
      exportSystemNode(node as Node<SystemNodeData>, nodesById, elements);
    } else if (node.type === "container") {
      exportContainerNode(node as Node<ContainerNodeData>, nodesById, elements);
    } else if (node.type === "sticky") {
      exportStickyNode(node as Node<StickyNoteData>, nodesById, elements);
    } else if (node.type === "text") {
      exportTextNode(node as Node<TextNodeData>, nodesById, elements);
    }
  }

  for (const edge of design.edges) {
    exportEdge(edge, nodesById, elements);
  }

  return JSON.stringify(
    {
      type: "excalidraw",
      version: 2,
      source: "system-designer",
      elements,
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    },
    null,
    2,
  );
}

function exportSystemNode(
  node: Node<SystemNodeData>,
  nodesById: Map<string, Node>,
  elements: ExcalidrawElement[],
) {
  const pos = absolutePosition(node, nodesById);
  const w = nodeWidth(node);
  const h = nodeHeight(node);
  const entry = registry.getOrDefault(node.data.componentType);
  const rectId = node.id;
  const textId = `${node.id}_text`;

  const rect = baseElement(rectId, "rectangle", pos.x, pos.y, w, h);
  rect.backgroundColor = entry.color + "22";
  rect.strokeColor = entry.color;
  rect.boundElements = [{ id: textId, type: "text" }];

  const label = `${node.data.label}\n(${entry.label})`;
  const text = baseElement(textId, "text", pos.x + w / 2, pos.y + h / 2, 0, 0);
  Object.assign(text, {
    text: label,
    fontSize: 14,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: rectId,
    originalText: label,
    autoResize: true,
  } satisfies Partial<ExcalidrawTextElement>);

  elements.push(rect, text);
}

function exportContainerNode(
  node: Node<ContainerNodeData>,
  nodesById: Map<string, Node>,
  elements: ExcalidrawElement[],
) {
  const pos = absolutePosition(node, nodesById);
  const w = nodeWidth(node);
  const h = nodeHeight(node);
  const rectId = node.id;
  const textId = `${node.id}_text`;

  const rect = baseElement(rectId, "rectangle", pos.x, pos.y, w, h);
  rect.strokeStyle = "dashed";
  rect.backgroundColor = node.data.color || "rgba(99,102,241,0.04)";
  rect.boundElements = [{ id: textId, type: "text" }];

  const label = node.data.label;
  const text = baseElement(textId, "text", pos.x + 10, pos.y + 10, 0, 0);
  Object.assign(text, {
    text: label,
    fontSize: 12,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    containerId: rectId,
    originalText: label,
    autoResize: true,
  } satisfies Partial<ExcalidrawTextElement>);

  elements.push(rect, text);
}

function exportStickyNode(
  node: Node<StickyNoteData>,
  nodesById: Map<string, Node>,
  elements: ExcalidrawElement[],
) {
  const pos = absolutePosition(node, nodesById);
  const w = nodeWidth(node);
  const h = nodeHeight(node);
  const rectId = node.id;
  const textId = `${node.id}_text`;

  const rect = baseElement(rectId, "rectangle", pos.x, pos.y, w, h);
  rect.backgroundColor = node.data.color;
  rect.fillStyle = "solid";
  rect.strokeColor = node.data.color;
  rect.boundElements = [{ id: textId, type: "text" }];

  const text = baseElement(textId, "text", pos.x + w / 2, pos.y + h / 2, 0, 0);
  Object.assign(text, {
    text: node.data.text || "",
    fontSize: 14,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: rectId,
    originalText: node.data.text || "",
    autoResize: true,
  } satisfies Partial<ExcalidrawTextElement>);

  elements.push(rect, text);
}

function exportTextNode(
  node: Node<TextNodeData>,
  nodesById: Map<string, Node>,
  elements: ExcalidrawElement[],
) {
  const pos = absolutePosition(node, nodesById);
  const fontSize = node.data.size === "large" ? 24 : node.data.size === "medium" ? 16 : 13;
  const textEl = baseElement(node.id, "text", pos.x, pos.y, 0, 0);
  Object.assign(textEl, {
    text: node.data.text || "",
    fontSize,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    originalText: node.data.text || "",
    autoResize: true,
  } satisfies Partial<ExcalidrawTextElement>);

  elements.push(textEl);
}

function exportEdge(edge: Edge, nodesById: Map<string, Node>, elements: ExcalidrawElement[]) {
  const sourceNode = nodesById.get(edge.source);
  const targetNode = nodesById.get(edge.target);
  if (!sourceNode || !targetNode) return;

  const sourcePos = absolutePosition(sourceNode, nodesById);
  const targetPos = absolutePosition(targetNode, nodesById);
  const sw = nodeWidth(sourceNode);
  const sh = nodeHeight(sourceNode);
  const tw = nodeWidth(targetNode);
  const th = nodeHeight(targetNode);

  const sx = sourcePos.x + sw / 2;
  const sy = sourcePos.y + sh / 2;
  const tx = targetPos.x + tw / 2;
  const ty = targetPos.y + th / 2;

  const arrowId = edge.id;
  const arrow = baseElement(arrowId, "arrow", sx, sy, tx - sx, ty - sy);
  Object.assign(arrow, {
    points: [
      [0, 0],
      [tx - sx, ty - sy],
    ],
    startBinding: { elementId: edge.source, focus: 0, gap: 5 },
    endBinding: { elementId: edge.target, focus: 0, gap: 5 },
    startArrowhead: null,
    endArrowhead: "arrow",
  } satisfies Partial<ExcalidrawArrowElement>);

  // Add label if present
  const data = edge.data as { label?: string; protocol?: string; format?: string } | undefined;
  const parts: string[] = [];
  if (data?.label) parts.push(data.label);
  if (data?.protocol) parts.push(data.protocol);
  if (data?.format) parts.push(data.format);
  const labelText = parts.join(" | ");

  if (labelText) {
    const textId = `${edge.id}_text`;
    const textEl = baseElement(textId, "text", sx + (tx - sx) / 2, sy + (ty - sy) / 2, 0, 0);
    Object.assign(textEl, {
      text: labelText,
      fontSize: 12,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: arrowId,
      originalText: labelText,
      autoResize: true,
    } satisfies Partial<ExcalidrawTextElement>);
    arrow.boundElements = [{ id: textId, type: "text" }];
    elements.push(textEl);
  }

  elements.push(arrow);
}

// Import: convert Excalidraw JSON to DesignJSON
function importFromExcalidraw(content: string): DesignJSON {
  const parsed = JSON.parse(content);
  const elements: ExcalidrawElement[] = parsed.elements ?? [];

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Index text elements by containerId for label lookup
  const textByContainer = new Map<string, ExcalidrawTextElement>();
  for (const el of elements) {
    if (el.type === "text" && (el as ExcalidrawTextElement).containerId) {
      textByContainer.set((el as ExcalidrawTextElement).containerId!, el as ExcalidrawTextElement);
    }
  }

  // Index all elements by id for arrow binding resolution
  const elementsById = new Map(elements.map((el) => [el.id, el]));

  for (const el of elements) {
    if (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond") {
      const node = importShapeAsNode(el, textByContainer);
      if (node) nodes.push(node);
    } else if (el.type === "text" && !(el as ExcalidrawTextElement).containerId) {
      // Standalone text → text node
      nodes.push({
        id: el.id,
        type: "text",
        position: { x: el.x, y: el.y },
        data: {
          text: (el as ExcalidrawTextElement).text || "",
          size:
            (el as ExcalidrawTextElement).fontSize >= 20
              ? "large"
              : (el as ExcalidrawTextElement).fontSize >= 15
                ? "medium"
                : "small",
        },
      });
    } else if (el.type === "arrow") {
      const edge = importArrowAsEdge(el as ExcalidrawArrowElement, textByContainer, elementsById);
      if (edge) edges.push(edge);
    }
  }

  return {
    version: 1,
    name: "Imported from Excalidraw",
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    flowPaths: [],
  };
}

function importShapeAsNode(
  el: ExcalidrawElement,
  textByContainer: Map<string, ExcalidrawTextElement>,
): Node | null {
  const textEl = textByContainer.get(el.id);
  const label = textEl?.text ?? "";

  // Detect container: dashed stroke style
  if (el.strokeStyle === "dashed") {
    return {
      id: el.id,
      type: "container",
      position: { x: el.x, y: el.y },
      style: { width: el.width, height: el.height },
      data: {
        label: label || "Container",
        color: el.backgroundColor || "rgba(99,102,241,0.04)",
        collapsed: false,
      },
    };
  }

  // Detect sticky: specific background colors
  const stickyColors = ["#fde68a", "#bbf7d0", "#bfdbfe", "#f9a8d4", "#e9d5ff"];
  if (stickyColors.includes(el.backgroundColor)) {
    return {
      id: el.id,
      type: "sticky",
      position: { x: el.x, y: el.y },
      style: { width: el.width, height: el.height },
      data: {
        text: label,
        color: el.backgroundColor as "#fde68a" | "#bbf7d0" | "#bfdbfe" | "#f9a8d4" | "#e9d5ff",
      },
    };
  }

  // System node — try to guess componentType from label
  const componentType = guessComponentType(label, el.strokeColor);
  const cleanLabel = label.replace(/\n\(.*\)$/, "").trim();

  return {
    id: el.id,
    type: "system",
    position: { x: el.x, y: el.y },
    data: {
      label: cleanLabel || "Component",
      componentType,
      status: "healthy",
      metrics: { cpu: 0, memory: 0, requestsPerSec: 0, latency: 0 },
      plan: {},
      sharded: false,
      shardKey: "",
      endpoints: [],
      capClassification: "",
      stressFailure: "none",
      capacityPercent: 100,
      consumerRate: 1000,
    },
  };
}

function guessComponentType(label: string, strokeColor: string): SystemNodeData["componentType"] {
  const lower = label.toLowerCase();

  // Try label matching first
  const labelMap: [string[], SystemNodeData["componentType"]][] = [
    [["database", "db", "postgres", "mysql", "mongo", "dynamo", "rds"], "database"],
    [["api gateway", "api-gateway", "gateway", "apigw"], "api-gateway"],
    [["service", "svc", "microservice", "backend"], "service"],
    [["cache", "redis", "memcached", "elasticache"], "cache"],
    [["queue", "kafka", "sqs", "rabbit", "message"], "message-queue"],
    [["storage", "s3", "bucket", "blob", "file"], "storage"],
    [["cdn", "cloudfront", "akamai", "fastly"], "cdn"],
    [["load balancer", "lb", "alb", "nlb", "elb"], "load-balancer"],
    [["firewall", "waf", "security"], "firewall"],
    [["webhook", "hook", "callback"], "webhook"],
    [["cron", "scheduler", "schedule", "job"], "cron"],
    [["client", "frontend", "browser", "mobile", "app"], "client"],
    [["search", "elasticsearch", "opensearch", "solr"], "search-engine"],
    [["dns", "route53", "domain", "nameserver"], "dns"],
    [["serverless", "lambda", "function", "faas"], "serverless"],
    [["kubernetes", "k8s", "ecs", "container", "orchestrat"], "container-orchestration"],
    [["stream", "kinesis", "flink", "processor"], "stream-processor"],
    [["warehouse", "redshift", "bigquery", "snowflake", "analytics"], "data-warehouse"],
  ];

  for (const [keywords, type] of labelMap) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }

  // Try color matching against registry
  const entries = registry.getAll();
  for (const entry of entries) {
    if (entry.color === strokeColor) return entry.id as SystemNodeData["componentType"];
  }

  return "service";
}

function importArrowAsEdge(
  el: ExcalidrawArrowElement,
  textByContainer: Map<string, ExcalidrawTextElement>,
  _elementsById: Map<string, ExcalidrawElement>,
): Edge | null {
  const source = el.startBinding?.elementId;
  const target = el.endBinding?.elementId;
  if (!source || !target) return null;

  const textEl = textByContainer.get(el.id);
  const labelText = textEl?.text ?? "";

  // Try to parse protocol/format from label
  const parts = labelText.split("|").map((s) => s.trim());
  const protocols = ["HTTP", "HTTPS", "gRPC", "WebSocket", "SSE", "TCP", "UDP", "AMQP", "MQTT"];
  const formats = ["JSON", "Protobuf", "Avro", "XML", "Binary", "Plain Text", "MessagePack"];

  let label = "";
  let protocol = "";
  let format = "";

  for (const part of parts) {
    if (protocols.includes(part)) protocol = part;
    else if (formats.includes(part)) format = part;
    else if (part) label = part;
  }

  return {
    id: el.id,
    source,
    target,
    type: "labeled",
    data: {
      label,
      protocol,
      format,
      partitioned: false,
      simulatedLatency: 0,
    },
  };
}

export const excalidrawConverter: ConverterModule = {
  id: "excalidraw",
  label: "Excalidraw",
  description: "Visual diagram interchange format",
  category: "diagram",
  fileExtensions: [".excalidraw", ".json"],
  canImport: true,

  exportDesign(design: DesignJSON) {
    return {
      content: exportToExcalidraw(design),
      filename: `${design.name}.excalidraw`,
      mimeType: "application/json",
    };
  },

  importDesign(content: string) {
    return importFromExcalidraw(content);
  },
};
