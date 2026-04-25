import type { ComponentType } from "../types";
import type { ToolDef } from "./types";
import CapacityCalculator from "./capacity-calculator/CapacityCalculator";
import CronTranslator from "./cron-translator/CronTranslator";
import SlaCalculator from "./sla-calculator/SlaCalculator";

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
];

export function getToolsForType(type: ComponentType): ToolDef[] {
  return TOOLS.filter((t) => t.relevantTo.includes(type));
}
