import type { ComponentRegistryEntry, ComponentTypeId, ComponentCategory } from "./types";
import { BUILTIN_ENTRIES } from "./builtin-entries";

class ComponentRegistry {
  private entries: Map<ComponentTypeId, ComponentRegistryEntry>;

  constructor() {
    this.entries = new Map();
    for (const entry of BUILTIN_ENTRIES) {
      this.entries.set(entry.id, entry);
    }
    this.loadCustomEntries();
  }

  get(id: ComponentTypeId): ComponentRegistryEntry | undefined {
    return this.entries.get(id);
  }

  getOrDefault(id: ComponentTypeId): ComponentRegistryEntry {
    return this.entries.get(id) ?? this.entries.get("database")!;
  }

  getAll(category?: ComponentCategory): ComponentRegistryEntry[] {
    const all = Array.from(this.entries.values());
    if (!category) return all;
    return all.filter((e) => e.category === category);
  }

  getBuiltins(): ComponentRegistryEntry[] {
    return this.getAll().filter((e) => e.source === "builtin");
  }

  getCustom(): ComponentRegistryEntry[] {
    return this.getAll().filter((e) => e.source === "custom");
  }

  /** Allow if either side declares the other in connectsTo (or has an empty list, meaning unrestricted). */
  canConnect(sourceTypeId: ComponentTypeId, targetTypeId: ComponentTypeId): boolean {
    const sourceEntry = this.entries.get(sourceTypeId);
    const targetEntry = this.entries.get(targetTypeId);
    if (!sourceEntry || !targetEntry) return false;
    const sourceAllows =
      sourceEntry.connectsTo.length === 0 || sourceEntry.connectsTo.includes(targetTypeId);
    const targetAllows =
      targetEntry.connectsTo.length === 0 || targetEntry.connectsTo.includes(sourceTypeId);
    return sourceAllows || targetAllows;
  }

  register(entry: ComponentRegistryEntry): void {
    this.entries.set(entry.id, { ...entry, source: "custom" });
    this.saveCustomEntries();
  }

  unregister(id: ComponentTypeId): boolean {
    const entry = this.entries.get(id);
    if (!entry || entry.source === "builtin") return false;
    this.entries.delete(id);
    this.saveCustomEntries();
    return true;
  }

  private loadCustomEntries(): void {
    try {
      const raw = localStorage.getItem("system-designer:custom-components");
      if (!raw) return;
      const customs: ComponentRegistryEntry[] = JSON.parse(raw);
      for (const entry of customs) {
        this.entries.set(entry.id, { ...entry, source: "custom" });
      }
    } catch {
      // ignore corrupt data
    }
  }

  private saveCustomEntries(): void {
    const customs = this.getCustom();
    localStorage.setItem("system-designer:custom-components", JSON.stringify(customs));
  }
}

export const registry = new ComponentRegistry();
