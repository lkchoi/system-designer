import type { NodeMetrics } from "./types";

export function randomMetrics(): NodeMetrics {
  return {
    cpu: Math.round(Math.random() * 90 + 5),
    memory: Math.round(Math.random() * 90 + 5),
    requestsPerSec: Math.round(Math.random() * 900 + 50),
    latency: Math.round(Math.random() * 400 + 10),
  };
}

export function displayType(type: string): string {
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
