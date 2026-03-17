import type { NormalizedStatusType } from "../lib/types.js";

export interface MockVendorState {
  vendorId: string;
  name: string;
  category: string;
  status: NormalizedStatusType;
  description: string;
  components: Array<{
    name: string;
    status: NormalizedStatusType;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    status: NormalizedStatusType;
    impact: string;
    createdAt: string;
  }>;
}

// Generate a statuspage-api response from a MockVendorState
export function toStatuspageResponse(state: MockVendorState) {
  const indicatorMap: Record<NormalizedStatusType, string> = {
    operational: "none",
    degraded: "minor",
    outage: "major",
    maintenance: "maintenance",
  };

  return {
    page: { id: state.vendorId, name: state.name, url: `https://status.${state.vendorId}.com` },
    status: {
      indicator: indicatorMap[state.status],
      description: state.description,
    },
    components: state.components.map((c, i) => ({
      id: `${state.vendorId}-comp-${i}`,
      name: c.name,
      status:
        c.status === "degraded"
          ? "degraded_performance"
          : c.status === "outage"
            ? "major_outage"
            : c.status,
      description: null,
      group_id: null,
    })),
    incidents: state.incidents.map((inc) => ({
      id: inc.id,
      name: inc.title,
      status: inc.status,
      impact: inc.impact,
      shortlink: `https://stspg.io/${inc.id}`,
      created_at: inc.createdAt,
      updated_at: inc.createdAt,
      resolved_at: null,
      incident_updates: [
        {
          id: `${inc.id}-upd-1`,
          status: "investigating",
          body: `Investigating: ${inc.title}`,
          created_at: inc.createdAt,
        },
      ],
    })),
  };
}

// Default state: all vendors operational
export function createDefaultVendorStates(): MockVendorState[] {
  const vendors = [
    {
      id: "github",
      name: "GitHub",
      category: "devtools",
      components: ["Git Operations", "API Requests", "Actions", "Copilot", "Pages"],
    },
    {
      id: "stripe",
      name: "Stripe",
      category: "payments",
      components: ["API", "Dashboard", "Checkout", "Webhooks"],
    },
    {
      id: "vercel",
      name: "Vercel",
      category: "hosting",
      components: ["Deployments", "Edge Network", "Serverless Functions", "Dashboard"],
    },
    {
      id: "cloudflare",
      name: "Cloudflare",
      category: "cdn",
      components: ["CDN/Cache", "DNS", "Workers", "Access", "Stream"],
    },
    {
      id: "netlify",
      name: "Netlify",
      category: "hosting",
      components: ["Builds", "CDN", "Functions", "DNS"],
    },
    {
      id: "datadog",
      name: "Datadog",
      category: "monitoring",
      components: ["Metrics", "APM", "Logs", "Monitors"],
    },
    {
      id: "pagerduty",
      name: "PagerDuty",
      category: "monitoring",
      components: ["Web App", "API", "Notifications", "Integrations"],
    },
    {
      id: "twilio",
      name: "Twilio",
      category: "communication",
      components: ["SMS", "Voice", "API", "Console"],
    },
    {
      id: "linear",
      name: "Linear",
      category: "devtools",
      components: ["App", "API", "Webhooks", "Sync"],
    },
    {
      id: "render",
      name: "Render",
      category: "hosting",
      components: ["Web Services", "Databases", "Static Sites", "Cron Jobs"],
    },
    {
      id: "flyio",
      name: "Fly.io",
      category: "hosting",
      components: ["Apps", "Machines API", "Volumes", "DNS"],
    },
    {
      id: "supabase",
      name: "Supabase",
      category: "databases",
      components: ["Database", "Auth", "Storage", "Realtime", "Edge Functions"],
    },
    {
      id: "heroku",
      name: "Heroku",
      category: "hosting",
      components: ["Apps", "API", "Dashboard", "Postgres"],
    },
    {
      id: "digitalocean",
      name: "DigitalOcean",
      category: "cloud",
      components: ["Droplets", "Spaces", "App Platform", "Kubernetes", "Databases"],
    },
    {
      id: "openai",
      name: "OpenAI",
      category: "ai",
      components: ["API", "ChatGPT", "DALL-E", "Playground"],
    },
    {
      id: "anthropic",
      name: "Anthropic",
      category: "ai",
      components: ["API", "Console", "Claude.ai"],
    },
    {
      id: "sentry",
      name: "Sentry",
      category: "monitoring",
      components: ["Web UI", "API", "Ingest", "Relay"],
    },
    { id: "npm", name: "npm", category: "devtools", components: ["Registry", "Website", "CLI"] },
    {
      id: "docker",
      name: "Docker",
      category: "devtools",
      components: ["Docker Hub", "Docker Desktop", "Docker Scout"],
    },
    {
      id: "aws",
      name: "AWS",
      category: "cloud",
      components: ["EC2", "S3", "Lambda", "RDS", "CloudFront"],
    },
    {
      id: "gcp",
      name: "Google Cloud",
      category: "cloud",
      components: ["Compute Engine", "Cloud SQL", "Cloud Storage", "Cloud Functions"],
    },
  ];

  return vendors.map((v) => ({
    vendorId: v.id,
    name: v.name,
    category: v.category,
    status: "operational" as const,
    description: "All Systems Operational",
    components: v.components.map((name) => ({ name, status: "operational" as const })),
    incidents: [],
  }));
}
