import type { ComponentRegistryEntry, ComponentTypeId, ComponentCategory } from "./types";
import { BUILTIN_ENTRIES } from "./builtin-entries";

class ComponentRegistry {
  private entries: Map<ComponentTypeId, ComponentRegistryEntry>;
  private connectsToSets: Map<ComponentTypeId, Set<ComponentTypeId>>;

  constructor() {
    this.entries = new Map();
    this.connectsToSets = new Map();
    for (const entry of BUILTIN_ENTRIES) {
      this.entries.set(entry.id, entry);
      this.connectsToSets.set(entry.id, new Set(entry.connectsTo));
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
    const sourceSet = this.connectsToSets.get(sourceTypeId);
    const targetSet = this.connectsToSets.get(targetTypeId);
    if (!sourceSet || !targetSet) return false;
    const sourceAllows = sourceSet.size === 0 || sourceSet.has(targetTypeId);
    const targetAllows = targetSet.size === 0 || targetSet.has(sourceTypeId);
    return sourceAllows || targetAllows;
  }

  register(entry: ComponentRegistryEntry): void {
    this.entries.set(entry.id, { ...entry, source: "custom" });
    this.connectsToSets.set(entry.id, new Set(entry.connectsTo));
    this.saveCustomEntries();
  }

  unregister(id: ComponentTypeId): boolean {
    const entry = this.entries.get(id);
    if (!entry || entry.source === "builtin") return false;
    this.entries.delete(id);
    this.connectsToSets.delete(id);
    this.saveCustomEntries();
    return true;
  }

  private loadCustomEntries(): void {
    try {
      const raw = localStorage.getItem("arkon:custom-components");
      if (!raw) return;
      const customs: ComponentRegistryEntry[] = JSON.parse(raw);
      for (const entry of customs) {
        this.entries.set(entry.id, { ...entry, source: "custom" });
        this.connectsToSets.set(entry.id, new Set(entry.connectsTo));
      }
    } catch {
      // ignore corrupt data
    }
  }

  private saveCustomEntries(): void {
    const customs = this.getCustom();
    localStorage.setItem("arkon:custom-components", JSON.stringify(customs));
  }
}

export const registry = new ComponentRegistry();
