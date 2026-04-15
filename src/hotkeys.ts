export interface HotkeyDef {
  id: string;
  key: string;
  mod?: boolean;
  shift?: boolean;
  guard?: boolean;
  label: string;
  category: "Mode" | "Canvas" | "Flow Path" | "Panels" | "Quick Add" | "Tools" | "Help";
}

export const HOTKEYS: HotkeyDef[] = [
  // Mode switching
  { id: "mode-plan", key: "1", guard: true, label: "Plan mode", category: "Mode" },
  { id: "mode-stress", key: "2", guard: true, label: "Stress mode", category: "Mode" },
  { id: "mode-monitor", key: "3", guard: true, label: "Monitor mode", category: "Mode" },
  { id: "mode-price", key: "4", guard: true, label: "Price mode", category: "Mode" },

  // Canvas
  { id: "redo", key: "z", mod: true, shift: true, label: "Redo", category: "Canvas" },
  { id: "undo", key: "z", mod: true, label: "Undo", category: "Canvas" },
  { id: "zoom-in", key: "=", mod: true, label: "Zoom in", category: "Canvas" },
  { id: "zoom-out", key: "-", mod: true, label: "Zoom out", category: "Canvas" },
  { id: "zoom-fit", key: "0", mod: true, label: "Fit view", category: "Canvas" },
  {
    id: "clear-canvas",
    key: "k",
    mod: true,
    shift: true,
    label: "Clear canvas",
    category: "Canvas",
  },
  {
    id: "select-all",
    key: "a",
    mod: true,
    guard: true,
    label: "Select all nodes",
    category: "Canvas",
  },

  // Flow path
  { id: "toggle-path", key: "f", guard: true, label: "Toggle flow path", category: "Flow Path" },
  {
    id: "save-path",
    key: "s",
    shift: true,
    guard: true,
    label: "Save flow path",
    category: "Flow Path",
  },
  {
    id: "clear-path",
    key: "x",
    shift: true,
    guard: true,
    label: "Clear flow path",
    category: "Flow Path",
  },

  // Panels
  { id: "close-or-deselect", key: "Escape", label: "Close / deselect", category: "Panels" },
  { id: "toggle-dock", key: "d", guard: true, label: "Toggle dock position", category: "Panels" },
  { id: "toggle-sidebar", key: "b", guard: true, label: "Toggle sidebar", category: "Panels" },

  // Quick add
  { id: "add-sticky", key: "s", guard: true, label: "Add sticky note", category: "Quick Add" },
  { id: "add-text", key: "t", guard: true, label: "Add text node", category: "Quick Add" },

  // Tools
  {
    id: "focus-filter",
    key: "/",
    guard: true,
    label: "Filter sidebar",
    category: "Tools",
  },
  {
    id: "show-capacity-calc",
    key: "c",
    guard: true,
    label: "Capacity calculator",
    category: "Tools",
  },

  { id: "export-design", key: "e", mod: true, label: "Export design", category: "Tools" },
  { id: "import-design", key: "i", mod: true, label: "Import design", category: "Tools" },

  // Help
  { id: "show-help", key: "?", guard: true, label: "Show shortcuts", category: "Help" },
];
