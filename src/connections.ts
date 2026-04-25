/**
 * Connection mapping interfaces.
 *
 * Two-layer architecture:
 *   Layer 1 — ComponentConnectionRule: defaults by component type pair
 *   Layer 2 — TechConnectionRule: overrides by technology ID pair
 *
 * `connections/` holds the data and lookup API; this file holds the types.
 */

import type { ComponentType, EdgeProtocol, EdgeFormat } from "./types";

// ─── Layer 1: Component-to-Component Defaults ───────────────────────────

/** Default edge properties for a source→target component type pair. */
export interface ComponentConnectionRule {
  source: ComponentType;
  target: ComponentType;
  /** Default protocol when user draws this edge. */
  protocol: EdgeProtocol;
  /** Default format when user draws this edge. */
  format: EdgeFormat;
  /** Default edge label (e.g., "queries", "publishes", "caches"). */
  label: string;
  /** How commonly this pairing appears in real architectures (0–1). */
  commonality: number;
}

// ─── Layer 2: Technology-to-Technology Overrides ─────────────────────────

/** IaC metadata generated when this connection exists in a design. */
export interface TechConnectionIaC {
  /** IAM actions the source needs on the target resource. */
  iamActions?: string[];
  /** CDK grant method to call on the target construct. */
  cdkGrant?: string;
  /** Pulumi grant method (mirrors CDK pattern). */
  pulumiGrant?: string;
  /** Security group rule: port(s) the source needs open to the target. */
  securityGroupPorts?: Array<{ port: number; protocol: "tcp" | "udp" }>;
  /** Kubernetes NetworkPolicy port to allow. */
  k8sPort?: number;
}

/** Technology-specific overrides for a connection pair. */
export interface TechConnectionRule {
  /** Source technology ID (e.g., "nodejs", "lambda") or "*" for any. */
  sourceTech: string;
  /** Target technology ID (e.g., "postgresql", "kafka"). */
  targetTech: string;
  /** Override protocol (if different from component-level default). */
  protocol?: EdgeProtocol;
  /** Override format. */
  format?: EdgeFormat;
  /** Override label. */
  label?: string;
  /** Set false to block this pairing (tech-level validation). */
  allowed?: boolean;
  /** Reason shown to user when allowed=false. */
  blockedReason?: string;
  /** Default port used for this connection. */
  port?: number;
  /**
   * Env var template. Tokens: {HOST}, {PORT}, {USER}, {PASSWORD}, {DB_NAME},
   * {REGION}, {ACCOUNT}, {BUCKET}, {QUEUE_NAME}, {TOPIC}, {PROJECT},
   * {DATASET}, {API_KEY}, {CONNECTION_STRING}, {ENDPOINT}, {CONTAINER}.
   */
  envVars?: Record<string, string>;
  /** IaC metadata for generating cross-resource references. */
  iac?: TechConnectionIaC;
}

// ─── Resolved (merged Layer 1 + Layer 2) ─────────────────────────────────

/** Merged result of component-level defaults + technology-level overrides. */
export interface ResolvedConnectionRule {
  source: ComponentType;
  target: ComponentType;
  protocol: EdgeProtocol;
  format: EdgeFormat;
  label: string;
  commonality: number;
  /** False when the tech pair is explicitly blocked. */
  allowed: boolean;
  /** Reason string when allowed=false. */
  blockedReason?: string;
  /** Env var template (from tech layer). */
  envVars?: Record<string, string>;
  /** IaC metadata (from tech layer). */
  iac?: TechConnectionIaC;
}
