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
  | 'cron';

export type NodeStatus = 'healthy' | 'warning' | 'error' | 'idle';

export interface NodeMetrics {
  cpu: number;
  memory: number;
  requestsPerSec: number;
  latency: number;
}

export interface SystemNodeData {
  label: string;
  componentType: ComponentType;
  status: NodeStatus;
  metrics: NodeMetrics;
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
