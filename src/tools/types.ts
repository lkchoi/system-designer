import type { ComponentType } from "../types";

export interface ToolDef {
  id: string;
  label: string;
  /** SVG path data for a 24x24 viewBox icon */
  icon: string;
  component: React.LazyExoticComponent<React.ComponentType<{ open: boolean; onClose: () => void }>>;
  relevantTo: ComponentType[];
}
