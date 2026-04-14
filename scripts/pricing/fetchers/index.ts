import type { Fetcher } from "../types.ts";

import { fetcher as aws } from "./aws.ts";
import { fetcher as azure } from "./azure.ts";
import { fetcher as gcp } from "./gcp.ts";
import { fetcher as cloudflare } from "./cloudflare.ts";
import { fetcher as databases } from "./databases.ts";
import { fetcher as dataServices } from "./data-services.ts";
import { fetcher as platforms } from "./platforms.ts";
import { fetcher as openSource } from "./open-source.ts";

/** All registered fetchers, keyed by name. */
export const FETCHERS: Record<string, Fetcher> = {
  aws,
  azure,
  gcp,
  cloudflare,
  databases,
  "data-services": dataServices,
  platforms,
  "open-source": openSource,
};
