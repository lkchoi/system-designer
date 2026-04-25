import type { ComponentType } from "../types";
import type { ToolDef } from "./types";
import CapacityCalculator from "./capacity-calculator/CapacityCalculator";
import CronTranslator from "./cron-translator/CronTranslator";
import SlaCalculator from "./sla-calculator/SlaCalculator";
import CacheSizer from "./cache-sizer/CacheSizer";
import JwtInspector from "./jwt-inspector/JwtInspector";
import PartitionCalculator from "./partition-calculator/PartitionCalculator";
import ConnectionPoolSizer from "./connection-pool-sizer/ConnectionPoolSizer";

const TOOLS: ToolDef[] = [
  {
    id: "capacity-calculator",
    label: "Capacity Calculator",
    icon: "M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm4 4h8M8 10h2M12 10h2M8 14h2M12 14h2M8 18h6",
    component: CapacityCalculator,
    relevantTo: [
      "database",
      "cache",
      "message-queue",
      "storage",
      "stream-processor",
      "data-warehouse",
      "cdn",
    ],
  },
  {
    id: "cron-translator",
    label: "Cron Translator",
    icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
    component: CronTranslator,
    relevantTo: ["cron", "serverless"],
  },
  {
    id: "sla-calculator",
    label: "SLA Calculator",
    icon: "M9 12l2 2 4-4M12 2a10 10 0 100 20 10 10 0 000-20z",
    component: SlaCalculator,
    relevantTo: [
      "database",
      "api-gateway",
      "service",
      "cache",
      "message-queue",
      "storage",
      "cdn",
      "load-balancer",
      "firewall",
      "webhook",
      "cron",
      "client",
      "search-engine",
      "dns",
      "serverless",
      "container-orchestration",
      "stream-processor",
      "data-warehouse",
    ],
  },
  {
    id: "cache-sizer",
    label: "Cache Sizer",
    icon: "M4 4h16v16H4zM4 9h16M9 4v16",
    component: CacheSizer,
    relevantTo: ["cache"],
  },
  {
    id: "jwt-inspector",
    label: "JWT Inspector",
    icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    component: JwtInspector,
    relevantTo: ["api-gateway", "firewall"],
  },
  {
    id: "partition-calculator",
    label: "Partition Calculator",
    icon: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    component: PartitionCalculator,
    relevantTo: ["message-queue", "stream-processor"],
  },
  {
    id: "connection-pool-sizer",
    label: "Connection Pool Sizer",
    icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z",
    component: ConnectionPoolSizer,
    relevantTo: ["database", "cache"],
  },
];

export function getToolsForType(type: ComponentType): ToolDef[] {
  return TOOLS.filter((t) => t.relevantTo.includes(type));
}
