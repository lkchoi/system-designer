/**
 * Connection mapping lookup API.
 *
 * Merges Layer 1 (component rules) with Layer 2 (tech rules) to produce
 * resolved connection metadata for edge auto-suggestion, IaC generation,
 * tech-level validation, and connection recommendations.
 */

export type {
  ComponentConnectionRule,
  TechConnectionRule,
  TechConnectionIaC,
  ResolvedConnectionRule,
} from "../connections";

import type {
  ComponentConnectionRule,
  TechConnectionRule,
  TechConnectionIaC,
  ResolvedConnectionRule,
} from "../connections";
import type { ComponentType } from "../types";
import { COMPONENT_RULES } from "./component-rules";
import { TECH_RULES } from "./tech-rules";

// ─── Internal indexes (built once) ─────────────────────────────────────

const componentIndex = new Map<string, ComponentConnectionRule>();
for (const rule of COMPONENT_RULES) {
  componentIndex.set(`${rule.source}:${rule.target}`, rule);
}

const techIndex = new Map<string, TechConnectionRule>();
const wildcardTechIndex = new Map<string, TechConnectionRule>();
for (const rule of TECH_RULES) {
  const key = `${rule.sourceTech}:${rule.targetTech}`;
  if (rule.sourceTech === "*") {
    wildcardTechIndex.set(rule.targetTech, rule);
  } else {
    techIndex.set(key, rule);
  }
}

// ─── Lookup helpers ────────────────────────────────────────────────────

function findTechRule(sourceTech: string, targetTech: string): TechConnectionRule | undefined {
  return techIndex.get(`${sourceTech}:${targetTech}`) ?? wildcardTechIndex.get(targetTech);
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Get the component-level connection default for a source→target pair.
 */
export function getComponentDefault(
  source: ComponentType,
  target: ComponentType,
): ComponentConnectionRule | undefined {
  return componentIndex.get(`${source}:${target}`);
}

/**
 * Get the tech-level rule for a specific (sourceTech, targetTech) pair.
 * Falls back to wildcard ("*") rules if no exact match exists.
 */
export function getTechRule(
  sourceTech: string,
  targetTech: string,
): TechConnectionRule | undefined {
  return findTechRule(sourceTech, targetTech);
}

/**
 * Merge component-level defaults with technology-level overrides into a
 * single resolved rule. Returns undefined if no component-level rule
 * exists for the pair.
 */
export function resolveConnection(
  sourceType: ComponentType,
  sourceTech: string,
  targetType: ComponentType,
  targetTech: string,
): ResolvedConnectionRule | undefined {
  const base = componentIndex.get(`${sourceType}:${targetType}`);
  if (!base) return undefined;

  const tech = findTechRule(sourceTech, targetTech);

  // Check for blocked pair — blocked rules from specific source override wildcards.
  const blocked = techIndex.get(`${sourceTech}:${targetTech}`);
  if (blocked?.allowed === false) {
    return {
      source: sourceType,
      target: targetType,
      protocol: base.protocol,
      format: base.format,
      label: base.label,
      commonality: base.commonality,
      allowed: false,
      blockedReason: blocked.blockedReason,
    };
  }

  return {
    source: sourceType,
    target: targetType,
    protocol: tech?.protocol ?? base.protocol,
    format: tech?.format ?? base.format,
    label: tech?.label ?? base.label,
    commonality: base.commonality,
    allowed: true,
    envVars: tech?.envVars,
    iac: tech?.iac,
  };
}

/**
 * Check if a technology pair is explicitly blocked.
 */
export function validateTechConnection(
  sourceTech: string,
  targetTech: string,
): { allowed: boolean; reason?: string } {
  const rule = techIndex.get(`${sourceTech}:${targetTech}`);
  if (rule?.allowed === false) {
    return { allowed: false, reason: rule.blockedReason };
  }
  return { allowed: true };
}

/**
 * Get recommended connection targets for a component type, sorted by
 * commonality descending. Optionally filter to only component types
 * already present in the design.
 */
export function getRecommendedTargets(
  sourceType: ComponentType,
  existingTypes?: ComponentType[],
): ComponentConnectionRule[] {
  const existing = existingTypes ? new Set(existingTypes) : undefined;
  return COMPONENT_RULES.filter(
    (r) => r.source === sourceType && (!existing || existing.has(r.target)),
  ).sort((a, b) => b.commonality - a.commonality);
}

/**
 * Get IaC metadata for a technology pair.
 */
export function getIaCMetadata(
  sourceTech: string,
  targetTech: string,
): TechConnectionIaC | undefined {
  return findTechRule(sourceTech, targetTech)?.iac;
}

/**
 * Get env var template for a technology pair.
 */
export function getEnvVarTemplate(
  sourceTech: string,
  targetTech: string,
): Record<string, string> | undefined {
  return findTechRule(sourceTech, targetTech)?.envVars;
}
