export type ComponentType =
  | 'database'
  | 'api-gateway'
  | 'service'
  | 'cache'
  | 'message-queue'
  | 'storage'
  | 'cdn'
  | 'load-balancer'
  | 'firewall'
  | 'webhook'
  | 'cron'
  | 'client'
  | 'search-engine'
  | 'dns'
  | 'serverless'
  | 'container-orchestration'
  | 'stream-processor'
  | 'data-warehouse';

export type NodeStatus = 'healthy' | 'warning' | 'error' | 'idle';

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
  type?: 'text' | 'technology';
}

export interface TechnologyInfo {
  name: string;
  throughput: string;
  limits: string;
  purpose: string;
  providers: string[];
}

export interface Endpoint {
  id: string;
  method: string;
  path: string;
}

export type EdgeProtocol = 'HTTP' | 'HTTPS' | 'gRPC' | 'WebSocket' | 'SSE' | 'TCP' | 'UDP' | 'AMQP' | 'MQTT' | '';
export type EdgeFormat = 'JSON' | 'Protobuf' | 'Avro' | 'XML' | 'Binary' | 'Plain Text' | 'MessagePack' | '';

export const EDGE_PROTOCOLS: EdgeProtocol[] = ['HTTP', 'HTTPS', 'gRPC', 'WebSocket', 'SSE', 'TCP', 'UDP', 'AMQP', 'MQTT'];
export const EDGE_FORMATS: EdgeFormat[] = ['JSON', 'Protobuf', 'Avro', 'XML', 'Binary', 'Plain Text', 'MessagePack'];

export interface EdgeData {
  label: string;
  protocol: EdgeProtocol;
  format: EdgeFormat;
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
  [key: string]: unknown;
}

export interface ComponentDefinition {
  type: ComponentType;
  label: string;
  color: string;
  icon: string;
}

export type StickyColor = '#fde68a' | '#bbf7d0' | '#bfdbfe' | '#f9a8d4' | '#e9d5ff';

export const STICKY_COLORS: StickyColor[] = [
  '#fde68a',
  '#bbf7d0',
  '#bfdbfe',
  '#f9a8d4',
  '#e9d5ff',
];

export interface StickyNoteData {
  text: string;
  color: StickyColor;
  [key: string]: unknown;
}

export type TextSize = 'small' | 'medium' | 'large';

export interface TextNodeData {
  text: string;
  size: TextSize;
  [key: string]: unknown;
}
