import type { TechnologyPricing, FetchResult } from "./types.ts";

export function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

export function warn(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.warn(`[${ts}] WARN ${msg}`);
}

/**
 * Fetch JSON from a URL with a 2-minute timeout.
 * Logs the request and throws on non-2xx responses.
 */
export async function fetchJson<T>(url: string, label?: string): Promise<T> {
  const tag = label ?? url.slice(0, 100);
  log(`  GET ${tag}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  }
  return (await res.json()) as T;
}

/**
 * Paginated JSON fetch. Follows `nextLink` until exhausted.
 * `items` extracts the array from each page body.
 */
export async function fetchJsonPages<T>(
  url: string,
  nextLink: (body: Record<string, unknown>) => string | undefined,
  items: (body: Record<string, unknown>) => T[],
): Promise<T[]> {
  const all: T[] = [];
  let current: string | undefined = url;
  let page = 0;
  while (current) {
    page++;
    log(`  GET page ${page}: ${current.slice(0, 120)}`);
    const res = await fetch(current, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${current}`);
    const body = (await res.json()) as Record<string, unknown>;
    all.push(...items(body));
    current = nextLink(body);
  }
  return all;
}

/** Format a numeric USD amount with appropriate precision. */
export function formatUsd(amount: number, unit: string): string {
  if (amount === 0) return "$0";
  if (amount < 0.0001) return `$${amount.toFixed(8)}/${unit}`;
  if (amount < 0.01) return `$${amount.toFixed(5)}/${unit}`;
  if (amount < 1) return `$${amount.toFixed(4)}/${unit}`;
  if (amount < 100) return `$${amount.toFixed(2)}/${unit}`;
  return `$${Math.round(amount)}/${unit}`;
}

/** Build a FetchResult from technology name + pricing + source URL/label. */
export function toResult(
  technology: string,
  pricing: TechnologyPricing,
  source: string,
): FetchResult {
  return { technology, pricing, source, fetchedAt: new Date().toISOString() };
}

/** Retry an async function up to `retries` times with linear backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 2000,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      warn(`Retry ${attempt + 1}/${retries}: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw new Error("unreachable");
}

/**
 * Run async tasks with bounded concurrency.
 * Returns results in the same order as the input.
 */
export async function parallelLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}
