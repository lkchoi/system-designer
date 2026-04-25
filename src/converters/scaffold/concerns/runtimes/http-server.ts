import type { RuntimeConcern } from "../types";

/**
 * Default HTTP server runtime — matches the current scaffold behavior.
 * No extra deps or imports; the language templates already emit the
 * standard HTTP server setup.
 */
export const httpServerRuntime: RuntimeConcern = {
  id: "http-server",
  appliesTo: ["go", "node", "python"],
  snippet: {},
};
