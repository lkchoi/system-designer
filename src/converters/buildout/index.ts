/**
 * Buildout public API.
 *
 * Takes a design (nodes + edges) and produces implementation artifacts.
 * Mirrors the scaffold subsystem's shape so CLI and UI callers see a
 * uniform interface.
 */

import type { Edge, Node } from "@xyflow/react";
import type { SystemNodeData } from "../../types";
import { resolveTechId } from "../iac-mapping";
import { resolveConcerns, type ConnectionInfo } from "../scaffold/concerns/resolve";
import type { ScaffoldLang } from "../scaffold/concerns/types";
import { pickGenerator } from "./dispatch";
import type {
  EdgeRef,
  BuildOutOpts,
  BuildOutResult,
  GeneratedFile,
  GeneratorContext,
} from "./types";

export * from "./types";
export { pickGenerator, registerGenerator } from "./dispatch";

/**
 * Map a tech id to a scaffold language. Same logic the scaffold package
 * uses internally, duplicated here to avoid leaking scaffold-internal
 * imports. If the two ever diverge, we'll pull this into a shared util.
 */
function techToLang(techId: string): ScaffoldLang {
  switch (techId) {
    case "python-fastapi":
      return "python";
    case "go":
      return "go";
    default:
      return "node";
  }
}

/**
 * Public entrypoint. Caller passes raw nodes/edges (same shape used by
 * the canvas) and gets back generated files keyed by per-node folders.
 *
 * Output paths are prefixed with `<node-label-slug>/` so multi-service
 * designs don't collide. Slug is kebab-case label.
 */
export async function buildOutDesign(
  nodes: Node[],
  edges: Edge[],
  opts: BuildOutOpts = {},
): Promise<BuildOutResult> {
  const result: BuildOutResult = { files: [], skipped: [], errors: [] };

  // Output folders are keyed by slugified label. Two nodes whose labels
  // slug to the same value would otherwise overwrite each other's files,
  // so track assigned slugs and disambiguate collisions.
  const usedSlugs = new Set<string>();

  for (const node of nodes) {
    const data = node.data as SystemNodeData | undefined;
    if (!data || typeof data !== "object" || !("componentType" in data)) {
      // Sticky / text / container nodes don't have a componentType.
      continue;
    }

    if (opts.onlyNodeIds && !opts.onlyNodeIds.includes(node.id)) continue;
    if (opts.onlyTypes && !opts.onlyTypes.includes(data.componentType)) continue;

    const inbound: EdgeRef[] = [];
    const outbound: EdgeRef[] = [];
    for (const e of edges) {
      if (e.source === node.id) {
        const targetNode = nodes.find((n) => n.id === e.target);
        const td = targetNode?.data as SystemNodeData | undefined;
        if (td && "componentType" in td) {
          outbound.push(toEdgeRef(targetNode!.id, td, e));
        }
      } else if (e.target === node.id) {
        const sourceNode = nodes.find((n) => n.id === e.source);
        const sd = sourceNode?.data as SystemNodeData | undefined;
        if (sd && "componentType" in sd) {
          inbound.push(toEdgeRef(sourceNode!.id, sd, e));
        }
      }
    }

    // For compute-like nodes, pre-resolve scaffold concerns so the prompt
    // tells the downstream LLM about the same client setup the scaffolded
    // code would have.
    const compute = data.componentType === "service" || data.componentType === "serverless";
    const techId = resolveTechId(data.componentType, data.plan?.technology ?? "", "docker");
    const lang = opts.defaultLanguage ?? techToLang(techId);
    const mergedSlots = compute
      ? resolveConcerns(
          lang,
          outbound.map<ConnectionInfo>((e) => ({
            targetName: e.otherNodeLabel,
            targetComponentType: e.otherComponentType,
            targetTechId: e.otherTechId,
            edgeLabel: e.label,
          })),
        )
      : undefined;

    const ctx: GeneratorContext = {
      node: { ...data, id: node.id },
      inbound,
      outbound,
      mergedSlots,
      language: lang,
      endpoints: data.endpoints,
    };

    const gen = pickGenerator(ctx);
    if (!gen) {
      result.skipped.push({
        nodeId: node.id,
        reason: `No generator registered for componentType=${data.componentType}`,
      });
      continue;
    }

    try {
      const files = await gen.generate(ctx);
      const slug = uniqueSlug(slugify(data.label || node.id), usedSlugs);
      for (const f of files) {
        result.files.push({ ...f, path: `${slug}/${f.path}` });
      }
    } catch (err) {
      result.errors.push({
        nodeId: node.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

function toEdgeRef(otherNodeId: string, otherData: SystemNodeData, edge: Edge): EdgeRef {
  const techId = resolveTechId(otherData.componentType, otherData.plan?.technology ?? "", "docker");
  // edge.data may carry protocol/format/label per our EdgeData type, but
  // it's typed loosely here to stay compatible with @xyflow/react's Edge.
  const ed = (edge.data ?? {}) as { protocol?: string; format?: string; label?: string };
  return {
    otherNodeId,
    otherNodeLabel: otherData.label,
    otherComponentType: otherData.componentType,
    otherTechId: techId,
    label: ed.label,
    protocol: ed.protocol || undefined,
    format: ed.format || undefined,
  };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "node"
  );
}

/**
 * Return `base` if unused, else append `-2`, `-3`, … until unique.
 * Records the chosen slug in `used` so later nodes don't collide.
 */
function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return slug;
}

// Re-export GeneratedFile to surface it for CLI/UI callers.
export type { GeneratedFile };
