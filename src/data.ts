import type { ComponentDefinition, NodeMetrics } from './types';

export const COMPONENTS: ComponentDefinition[] = [
  { type: 'database', label: 'Database', color: '#6366f1', icon: 'M4 7v10c0 2.2 3.6 4 8 4s8-1.8 8-4V7M4 7c0 2.2 3.6 4 8 4s8-1.8 8-4M4 7c0-2.2 3.6-4 8-4s8 1.8 8 4M4 12c0 2.2 3.6 4 8 4s8-1.8 8-4' },
  { type: 'api-gateway', label: 'API Gateway', color: '#f97316', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { type: 'service', label: 'Service', color: '#22c55e', icon: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm3 4h2m-2 4h2m-2 4h2' },
  { type: 'cache', label: 'Cache', color: '#a855f7', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8' },
  { type: 'message-queue', label: 'Message Queue', color: '#eab308', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { type: 'storage', label: 'Storage', color: '#14b8a6', icon: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z' },
  { type: 'cdn', label: 'CDN', color: '#ec4899', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z' },
  { type: 'load-balancer', label: 'Load Balancer', color: '#6366f1', icon: 'M12 3v18m-7-7l7 7 7-7M5 8h14M8 5h8' },
  { type: 'firewall', label: 'Firewall', color: '#ef4444', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { type: 'webhook', label: 'Webhook', color: '#06b6d4', icon: 'M15 7h3a5 5 0 015 5 5 5 0 01-5 5h-3m-6 0H6a5 5 0 01-5-5 5 5 0 015-5h3M8 12h8' },
  { type: 'cron', label: 'Cron', color: '#8b5cf6', icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4v6l4 2' },
];

export function getComponentDef(type: string): ComponentDefinition {
  return COMPONENTS.find(c => c.type === type) ?? COMPONENTS[0];
}

export function randomMetrics(): NodeMetrics {
  return {
    cpu: Math.round(Math.random() * 90 + 5),
    memory: Math.round(Math.random() * 90 + 5),
    requestsPerSec: Math.round(Math.random() * 900 + 50),
    latency: Math.round(Math.random() * 400 + 10),
  };
}

export function displayType(type: string): string {
  return type
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
