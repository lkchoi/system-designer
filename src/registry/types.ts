import type { PlanFieldDef, TechnologyInfo } from "../types";

export type ComponentTypeId = string;

export type ComponentCategory =
  | "compute"
  | "data"
  | "networking"
  | "messaging"
  | "scheduling"
  | "storage"
  | "client"
  | "custom";

export interface ComponentRegistryEntry {
  id: ComponentTypeId;
  label: string;
  color: string;
  icon: string;
  category: ComponentCategory;
  planFields: PlanFieldDef[];
  technologies: TechnologyInfo[];
  connectsTo: ComponentTypeId[];
  source: "builtin" | "custom";
}
