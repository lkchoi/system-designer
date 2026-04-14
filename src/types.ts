export type ComponentType =
  | "database"
  | "api-gateway"
  | "service"
  | "cache"
  | "message-queue"
  | "storage"
  | "cdn"
  | "load-balancer"
  | "firewall"
  | "webhook"
  | "cron"
  | "client"
  | "search-engine"
  | "dns"
  | "serverless"
  | "container-orchestration"
  | "stream-processor"
  | "data-warehouse";

export type NodeStatus = "healthy" | "warning" | "error" | "idle";

export interface NodeMetrics {
  cpu: number;
  memory: number;
  requestsPerSec: number;
  latency: number;
}

export interface PlanFieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "technology";
}

export interface PricingTier {
  name: string;
  price: string;
  description?: string;
}

export interface PricingMode {
  name: string;
  priceImpact: string;
  description: string;
}

export interface TechnologyPricing {
  /** Brief description of how this service is billed */
  model: string;
  /** The primary billing unit explained (e.g., what is an RCU?) */
  unit: string;
  /** Key price points / tiers */
  tiers: PricingTier[];
  /** Free tier details if available */
  freeTier?: string;
  /** Special modes like HA, consistency levels, reserved capacity */
  modes?: PricingMode[];
}

export interface TechnologyInfo {
  id: string;
  name: string;
  throughput: string;
  limits: string;
  purpose: string;
  providers: string[];
  pricing?: TechnologyPricing;
}

export interface Endpoint {
  id: string;
  method: string;
  path: string;
}

export type EdgeProtocol =
  | "HTTP"
  | "HTTPS"
  | "gRPC"
  | "WebSocket"
  | "SSE"
  | "TCP"
  | "UDP"
  | "AMQP"
  | "MQTT"
  | "";
export type EdgeFormat =
  | "JSON"
  | "Protobuf"
  | "Avro"
  | "XML"
  | "Binary"
  | "Plain Text"
  | "MessagePack"
  | "";

export const EDGE_PROTOCOLS: EdgeProtocol[] = [
  "HTTP",
  "HTTPS",
  "gRPC",
  "WebSocket",
  "SSE",
  "TCP",
  "UDP",
  "AMQP",
  "MQTT",
];
export const EDGE_FORMATS: EdgeFormat[] = [
  "JSON",
  "Protobuf",
  "Avro",
  "XML",
  "Binary",
  "Plain Text",
  "MessagePack",
];

export interface EdgeData {
  label: string;
  protocol: EdgeProtocol;
  format: EdgeFormat;
  partitioned: boolean;
}

export type CAPClassification = "CP" | "AP" | "CA" | "";
export type StressFailure = "none" | "overloaded" | "down";

export interface EffectiveStress {
  status: NodeStatus;
  reason: "direct" | "cascade" | "partition-cp" | "partition-ap" | "healthy";
  explanation: string;
}

export interface SystemNodeData {
  label: string;
  componentType: ComponentType;
  status: NodeStatus;
  metrics: NodeMetrics;
  plan: Record<string, string>;
  sharded: boolean;
  shardKey: string;
  endpoints: Endpoint[];
  capClassification: CAPClassification;
  stressFailure: StressFailure;
  [key: string]: unknown;
}

export interface ComponentDefinition {
  type: ComponentType;
  label: string;
  color: string;
  icon: string;
}

export type StickyColor = "#fde68a" | "#bbf7d0" | "#bfdbfe" | "#f9a8d4" | "#e9d5ff";

export const STICKY_COLORS: StickyColor[] = ["#fde68a", "#bbf7d0", "#bfdbfe", "#f9a8d4", "#e9d5ff"];

export interface StickyNoteData {
  text: string;
  color: StickyColor;
  [key: string]: unknown;
}

export type TextSize = "small" | "medium" | "large";

export interface TextNodeData {
  text: string;
  size: TextSize;
  [key: string]: unknown;
}

export interface SavedFlow {
  id: string;
  name: string;
  description: string;
  steps: string[];
}
