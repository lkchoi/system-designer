import type { Fetcher, FetchResult, TechnologyPricing } from "../types.ts";
import { log, toResult } from "../utils.ts";

// Managed platform services — API gateways, CDNs, webhooks, scheduling, containers.
// Each vendor has their own pricing page; no unified API.

const SOURCES: Record<string, string> = {
  Kong: "https://konghq.com/pricing",
  Apigee: "https://cloud.google.com/apigee/pricing",
  HAProxy: "https://www.haproxy.com/pricing",
  Fastly: "https://www.fastly.com/pricing",
  Akamai: "https://www.akamai.com/pricing",
  "Vercel Edge Network": "https://vercel.com/pricing",
  "Vercel Functions": "https://vercel.com/pricing",
  ngrok: "https://ngrok.com/pricing",
  "Palo Alto Networks": "https://www.paloaltonetworks.com/",
  "NS1 (IBM)": "https://ns1.com/plans",
  Svix: "https://www.svix.com/pricing/",
  Hookdeck: "https://hookdeck.com/pricing",
  "Zapier Webhooks": "https://zapier.com/pricing",
  Temporal: "https://temporal.io/pricing",
  "Red Hat OpenShift":
    "https://www.redhat.com/en/technologies/cloud-computing/openshift/pricing",
  "Nomad (HashiCorp)": "https://www.hashicorp.com/products/nomad/pricing",
};

const STATIC: Record<string, TechnologyPricing> = {
  Kong: {
    model:
      "Monthly subscription per gateway + per-request overages. Gateway type determines cost.",
    unit: "Gateway service/month + per million API requests.",
    tiers: [
      {
        name: "Plus Plan",
        price: "~$105/month per gateway",
        description: "1M requests included; $200/additional million",
      },
      {
        name: "Enterprise",
        price: "Custom (annual)",
        description: "Unlimited gateways, portals, SSO, dedicated TAM",
      },
    ],
    freeTier: "30-day trial with full Enterprise features",
  },

  Apigee: {
    model:
      "Pay-as-you-go (per API call + environment hourly) or annual subscription tiers.",
    unit: "API proxy calls. Standard proxies cost 1/5 of Extensible proxies. Environment type affects hourly base cost.",
    tiers: [
      {
        name: "Standard Proxy (PAYG)",
        price: "$20/million calls",
        description: "First 50M; lighter policies",
      },
      {
        name: "Extensible Proxy (PAYG)",
        price: "$100/million calls",
        description: "First 50M; full policy set (5x standard)",
      },
      {
        name: "Base Environment",
        price: "$0.50/hr",
        description: "20 proxy units included",
      },
      {
        name: "Comprehensive Environment",
        price: "$4.70/hr",
        description: "100 proxy units included",
      },
      {
        name: "Subscription Enterprise",
        price: "~$1,460/month",
        description: "7.5B calls/year included",
      },
    ],
    freeTier: "60-day evaluation tier with full platform access",
  },

  HAProxy: {
    model: "Open source (free). HAProxy Cloud for managed deployments.",
    unit: "Free for self-hosted. Managed service pricing via HAProxy Cloud.",
    tiers: [
      {
        name: "Community Edition",
        price: "Free",
        description: "Open source, self-hosted",
      },
      {
        name: "HAProxy Enterprise",
        price: "Contact sales",
        description: "Commercial support, advanced features",
      },
    ],
  },

  Fastly: {
    model:
      "Usage-based per GB bandwidth + per request. $50/month minimum, or committed packages from $1,500/month.",
    unit: "Per GB delivered + per 10,000 requests. Rates vary by region.",
    tiers: [
      {
        name: "US/EU Bandwidth",
        price: "$0.12/GB",
        description: "First 10 TB/month",
      },
      {
        name: "Asia/LATAM",
        price: "$0.19–$0.28/GB",
        description: "2–3x North America rates",
      },
      {
        name: "Requests (US/EU)",
        price: "$0.0075 per 10,000",
        description: "Per HTTP request",
      },
      {
        name: "Growth (committed)",
        price: "From $1,500/month",
        description: "Better per-GB rates, priority support, SLA",
      },
    ],
    freeTier:
      "$50/month recurring credit (perpetual low-volume free tier for small workloads)",
  },

  Akamai: {
    model:
      "Contract-based only. No published public pricing. Minimum 12-month contracts, typically $5,000–$15,000+/month.",
    unit: "Negotiated per-GB rates based on committed monthly bandwidth volume and geographic mix.",
    tiers: [
      {
        name: "US/EU (0–10 TB)",
        price: "~$0.049/GB",
        description: "Indicative, not official",
      },
      {
        name: "US/EU (>50 TB)",
        price: "Negotiated (<$0.01/GB possible)",
        description: "Large customers with 100s of TB/month",
      },
      {
        name: "APAC/LATAM",
        price: "30–60% more than US",
        description: "Higher regional rates",
      },
    ],
  },

  "Vercel Edge Network": {
    model:
      "Bundled into Vercel platform plans. No separate CDN line item. Overages at per-GB rate.",
    unit: "Plan-based with overage charges on data transfer and edge requests.",
    tiers: [
      {
        name: "Hobby (Free)",
        price: "$0/month",
        description: "100 GB transfer + 1M edge requests",
      },
      {
        name: "Pro",
        price: "$20/seat/month",
        description: "1 TB transfer + 10M edge requests",
      },
      {
        name: "Bandwidth Overage",
        price: "$0.15/GB",
        description: "Above plan limits (higher than raw CloudFront)",
      },
      {
        name: "Edge Request Overage",
        price: "$2.00/million",
        description: "Above 10M/month on Pro",
      },
    ],
    freeTier:
      "100 GB transfer + 1M edge requests/month (Hobby, personal projects only)",
  },

  "Vercel Functions": {
    model:
      "Plan-based with usage limits and overage. Not pure pay-per-invocation.",
    unit: "CPU-hours + GB-hours + invocations, with plan-based included allocations.",
    tiers: [
      {
        name: "Hobby (Free)",
        price: "$0/month",
        description: "60s timeout, 100 GB bandwidth, 1M edge requests",
      },
      {
        name: "Pro",
        price: "$20/seat/month",
        description: "1 TB bandwidth, 10M edge requests, $20 usage credit",
      },
      {
        name: "Serverless Compute Overage",
        price: "$0.128/CPU-hr",
        description: "Above included allocation",
      },
      {
        name: "Memory Overage",
        price: "$0.0106/GB-hr",
        description: "Above included allocation",
      },
      {
        name: "Invocation Overage",
        price: "$0.60/million",
        description: "Above plan limits",
      },
    ],
    freeTier: "Hobby plan: free for personal/non-commercial projects",
  },

  ngrok: {
    model:
      "Plan-based with usage limits and overages on data transfer and HTTP requests.",
    unit: "Data transfer (GB) + HTTP requests (per 100K).",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        description: "3 endpoints, 1 GB one-time credit, 20K requests/month",
      },
      {
        name: "Pay-as-You-Go",
        price: "$20/month",
        description:
          "Unlimited endpoints, 5 GB included, $0.10/GB overage",
      },
      {
        name: "HTTP Request Overage",
        price: "$1/100K requests",
        description: "Above included allocation",
      },
    ],
    freeTier: "3 endpoints + 1 GB data + 20K requests/month",
  },

  "Palo Alto Networks": {
    model:
      "Credit-based (1–5 year pre-purchase) or PAYG from AWS/Azure Marketplace. Hourly rate + per-GB traffic + security service add-ons.",
    unit: "Hourly NGFW resource rate + tiered per-GB traffic charge. Credits are multi-cloud fungible.",
    tiers: [
      {
        name: "PAYG (AWS)",
        price: "Custom per-hour + per-GB",
        description: "On-demand from Marketplace",
      },
      {
        name: "Credit-Based (1–3yr)",
        price: "Discounted pre-purchase",
        description: "Credits consumed by usage; overages at PAYG rates",
      },
    ],
    freeTier: "30-day free trial on AWS Marketplace",
  },

  "NS1 (IBM)": {
    model:
      "Annual subscription bundles with fixed query quota, records, and monitors. Overage per unit above limits.",
    unit: "Monthly plan with query/month quota. Overage: ~$50/million excess queries.",
    tiers: [
      {
        name: "Essentials",
        price: "$99/month",
        description: "30M queries/month, 1,000 records",
      },
      {
        name: "Essentials Large",
        price: "$349/month",
        description: "80M queries/month, 1,000 records",
      },
      {
        name: "Standard-150",
        price: "$786/month",
        description: "150M queries, 3 filter chains, 7 monitors",
      },
      {
        name: "Standard-1000",
        price: "$3,879/month",
        description: "1B queries, 10K records, 100 monitors",
      },
    ],
    freeTier: "Developer plan with limited scale, full API access",
  },

  Svix: {
    model:
      "Plan-based with per-message overage. Only attempted messages count — retries are free.",
    unit: "Messages/month. 1 message = 1 webhook delivery attempt.",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        description: "50K messages, 50 msg/sec, 30-day retention",
      },
      {
        name: "Professional",
        price: "$490/month",
        description: "50K included, $0.0001/msg overage, 400 msg/sec",
      },
      {
        name: "Enterprise",
        price: "Custom",
        description: "On-premises, VPC peering, 99.999% SLA",
      },
    ],
    freeTier: "50,000 messages/month, 99.9% SLA",
  },

  Hookdeck: {
    model:
      "Plan-based with per-event overage. Retries included at no extra cost.",
    unit: "Events/month. 1 event = 1 inbound webhook delivery attempt.",
    tiers: [
      {
        name: "Developer",
        price: "$0/month",
        description: "10K events, 3-day retention, 1 user",
      },
      {
        name: "Team",
        price: "$39/month",
        description: "10K included + $0.33/100K overage",
      },
      {
        name: "Growth",
        price: "$499/month",
        description: "10K included + overage, 30-day retention, SLA",
      },
    ],
    freeTier: "10,000 events/month, 3-day retention",
  },

  "Zapier Webhooks": {
    model:
      "Included in Zapier plan (per-task pricing). Webhooks are a trigger/action type within Zaps.",
    unit: "Zapier tasks/month. Webhook triggers consume tasks like any other Zap step.",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        description: "100 tasks/month",
      },
      {
        name: "Professional",
        price: "$29.99/month",
        description: "750 tasks/month",
      },
    ],
  },

  Temporal: {
    model:
      "Per action + storage. Actions are billable operations between your app and Temporal Cloud.",
    unit: "Action — each meaningful state change counts: Workflow Started, Signal sent, Query executed, Heartbeat, Update (successful or rejected). NOT counted: timer creation, activity scheduling, continue-as-new.",
    tiers: [
      {
        name: "First 5M actions",
        price: "$50/million",
        description: "Decreasing tiers with volume",
      },
      {
        name: "50M–100M actions",
        price: "$30/million",
        description: "Volume discount",
      },
      {
        name: "100M–200M actions",
        price: "$25/million",
        description: "High-volume tier",
      },
      {
        name: "Active Storage",
        price: "$0.042/GB-hr",
        description: "Open/running workflows",
      },
      {
        name: "Retained Storage",
        price: "$0.00105/GB-hr",
        description: "Completed/closed workflows",
      },
      {
        name: "Essentials Plan",
        price: "$100/month minimum",
        description:
          "1M actions + 1 GB active + 40 GB retained included",
      },
    ],
  },

  "Red Hat OpenShift": {
    model:
      "ROSA (AWS): $0.25/cluster/hr + $0.171/4 vCPUs/hr worker fee + EC2 infrastructure costs.",
    unit: "Cluster-hour + worker node service fee per 4 vCPUs + underlying EC2 costs.",
    tiers: [
      {
        name: "ROSA HCP Cluster Fee",
        price: "$0.25/cluster/hr (~$182/mo)",
        description: "Hosted control plane",
      },
      {
        name: "Worker Node Fee",
        price: "$0.171/hr per 4 vCPUs",
        description: "Red Hat subscription layer on EC2",
      },
      {
        name: "Minimum Viable Cluster",
        price: "~$1,400+/month",
        description:
          "3 workers + 3 infra nodes (m5.xlarge) + cluster fee",
      },
    ],
    modes: [
      {
        name: "1-Year Commit",
        priceImpact: "~33% savings on worker fee",
        description: "$0.115/hr per 4 vCPUs",
      },
      {
        name: "3-Year Commit",
        priceImpact: "~55% savings on worker fee",
        description: "$0.077/hr per 4 vCPUs",
      },
    ],
  },

  "Nomad (HashiCorp)": {
    model:
      "Open source free. Enterprise: licensed per cluster (contact sales). HCP Nomad: managed, pricing not public.",
    unit: "Per cluster license (Enterprise) + underlying infrastructure costs.",
    tiers: [
      {
        name: "Open Source",
        price: "Free",
        description: "No licensing cost, self-hosted",
      },
      {
        name: "Enterprise",
        price: "Contact sales",
        description:
          "Governance, multi-region federation, audit logging",
      },
      {
        name: "HCP Nomad",
        price: "Contact sales",
        description: "Managed by HashiCorp/IBM",
      },
    ],
  },
};

export const fetcher: Fetcher = {
  name: "platforms",
  description:
    "Managed platform services (API gateways, CDNs, webhooks, scheduling, containers)",
  technologies: Object.keys(STATIC),
  async fetch(): Promise<FetchResult[]> {
    log("Platforms: using static reference data");
    return Object.entries(STATIC).map(([tech, pricing]) =>
      toResult(tech, pricing, SOURCES[tech] ?? "vendor pricing page"),
    );
  },
};
