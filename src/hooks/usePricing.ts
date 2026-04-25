import { useState, useEffect } from "react";
import type { TechnologyPricing } from "../types";

let cache: Record<string, TechnologyPricing> | null = null;
let promise: Promise<Record<string, TechnologyPricing>> | null = null;

function load(): Promise<Record<string, TechnologyPricing>> {
  if (!promise) {
    promise = import("../registry/pricing").then((m) => {
      cache = m.PRICING;
      return cache;
    });
  }
  return promise;
}

export function usePricing(): Record<string, TechnologyPricing> | null {
  const [pricing, setPricing] = useState(cache);

  useEffect(() => {
    if (!cache) {
      load().then(setPricing);
    }
  }, []);

  return pricing;
}
