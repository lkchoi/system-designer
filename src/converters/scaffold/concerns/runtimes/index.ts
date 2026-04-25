import type { RuntimeConcern } from "../types";
import { httpServerRuntime } from "./http-server";
import { lambdaRuntime } from "./lambda";

export const RUNTIME_CONCERNS: readonly RuntimeConcern[] = [
  httpServerRuntime,
  lambdaRuntime,
];

const byId = new Map<string, RuntimeConcern>();
for (const r of RUNTIME_CONCERNS) byId.set(r.id, r);

/** Look up a runtime concern by ID. */
export function getRuntimeConcern(id: string): RuntimeConcern | undefined {
  return byId.get(id);
}
