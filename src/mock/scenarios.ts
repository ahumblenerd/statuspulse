import type { NormalizedStatusType } from "../lib/types.js";
import type { MockVendorState } from "./data.js";
import { createDefaultVendorStates } from "./data.js";

export interface Scenario {
  name: string;
  description: string;
  apply: (states: MockVendorState[]) => MockVendorState[];
}

function setVendorStatus(
  states: MockVendorState[],
  vendorId: string,
  status: NormalizedStatusType,
  description: string,
  degradedComponents?: string[],
  incidents?: MockVendorState["incidents"]
): MockVendorState[] {
  return states.map((s) => {
    if (s.vendorId !== vendorId) return s;
    return {
      ...s,
      status,
      description,
      components: s.components.map((c) => ({
        ...c,
        status: degradedComponents?.includes(c.name) ? status : c.status,
      })),
      incidents: incidents ?? s.incidents,
    };
  });
}

function now() {
  return new Date().toISOString();
}

export const scenarios: Record<string, Scenario> = {
  "all-green": {
    name: "All Green",
    description: "All 19 demo vendors are fully operational",
    apply: (states) => states, // default is already all-green
  },

  "github-outage": {
    name: "GitHub Outage",
    description: "GitHub experiencing major outage affecting Git Operations and Actions",
    apply: (states) =>
      setVendorStatus(
        states,
        "github",
        "outage",
        "Major System Outage",
        ["Git Operations", "Actions", "API Requests"],
        [
          {
            id: "gh-outage-1",
            title: "Major outage affecting Git Operations and Actions",
            status: "outage",
            impact: "critical",
            createdAt: now(),
          },
          {
            id: "gh-outage-2",
            title: "API request failures across all regions",
            status: "outage",
            impact: "major",
            createdAt: now(),
          },
        ]
      ),
  },

  "multi-degraded": {
    name: "Multiple Degraded",
    description: "GitHub, Stripe, and Vercel all experiencing degraded performance",
    apply: (states) => {
      let result = setVendorStatus(
        states,
        "github",
        "degraded",
        "Degraded Performance",
        ["Actions"],
        [
          {
            id: "gh-deg-1",
            title: "Elevated error rates for GitHub Actions",
            status: "degraded",
            impact: "minor",
            createdAt: now(),
          },
        ]
      );
      result = setVendorStatus(
        result,
        "stripe",
        "degraded",
        "Degraded Performance",
        ["API", "Webhooks"],
        [
          {
            id: "stripe-deg-1",
            title: "Increased API latency",
            status: "degraded",
            impact: "minor",
            createdAt: now(),
          },
        ]
      );
      result = setVendorStatus(
        result,
        "vercel",
        "degraded",
        "Degraded Performance",
        ["Deployments"],
        [
          {
            id: "vercel-deg-1",
            title: "Slow deployment times",
            status: "degraded",
            impact: "minor",
            createdAt: now(),
          },
        ]
      );
      return result;
    },
  },

  "cloud-cascade": {
    name: "Cloud Cascade Failure",
    description: "AWS outage cascading to hosted services (Vercel, Netlify, Heroku)",
    apply: (states) => {
      let result = states;
      // AWS is down
      result = setVendorStatus(
        result,
        "aws",
        "outage",
        "Major Infrastructure Outage",
        ["EC2", "Lambda", "RDS"],
        [
          {
            id: "aws-outage-1",
            title: "Service disruption affecting US East unavailable",
            status: "outage",
            impact: "critical",
            createdAt: now(),
          },
        ]
      );
      // DigitalOcean also affected
      result = setVendorStatus(
        result,
        "digitalocean",
        "outage",
        "Major Infrastructure Outage",
        ["Droplets", "App Platform", "Databases"],
        [
          {
            id: "do-outage-1",
            title: "US East datacenter experiencing connectivity issues",
            status: "outage",
            impact: "critical",
            createdAt: now(),
          },
        ]
      );
      // Cascade
      result = setVendorStatus(
        result,
        "vercel",
        "degraded",
        "Upstream Infrastructure Issues",
        ["Serverless Functions", "Edge Network"],
        [
          {
            id: "vercel-cascade-1",
            title: "Degraded performance due to upstream infrastructure",
            status: "degraded",
            impact: "minor",
            createdAt: now(),
          },
        ]
      );
      result = setVendorStatus(
        result,
        "netlify",
        "degraded",
        "Build Delays",
        ["Builds", "Functions"],
        [
          {
            id: "netlify-cascade-1",
            title: "Extended build times due to infrastructure issues",
            status: "degraded",
            impact: "minor",
            createdAt: now(),
          },
        ]
      );
      result = setVendorStatus(
        result,
        "heroku",
        "outage",
        "App Unavailability",
        ["Apps", "Postgres"],
        [
          {
            id: "heroku-cascade-1",
            title: "Applications down in US region",
            status: "outage",
            impact: "major",
            createdAt: now(),
          },
        ]
      );
      return result;
    },
  },

  "maintenance-window": {
    name: "Maintenance Window",
    description: "GitHub and Cloudflare undergoing scheduled maintenance",
    apply: (states) => {
      let result = setVendorStatus(
        states,
        "github",
        "maintenance",
        "Scheduled Maintenance",
        ["Pages"],
        [
          {
            id: "gh-maint-1",
            title: "Scheduled maintenance: GitHub Pages infrastructure upgrade",
            status: "maintenance",
            impact: "maintenance",
            createdAt: now(),
          },
        ]
      );
      result = setVendorStatus(
        result,
        "cloudflare",
        "maintenance",
        "Scheduled Maintenance",
        ["Workers"],
        [
          {
            id: "cf-maint-1",
            title: "Workers runtime upgrade — brief interruptions expected",
            status: "maintenance",
            impact: "maintenance",
            createdAt: now(),
          },
        ]
      );
      return result;
    },
  },

  "mixed-reality": {
    name: "Mixed Reality",
    description: "Realistic mix: most green, 2 degraded, 1 maintenance — typical day",
    apply: (states) => {
      let result = setVendorStatus(
        states,
        "npm",
        "degraded",
        "Elevated Error Rates",
        ["Registry"],
        [
          {
            id: "npm-deg-1",
            title: "Intermittent 503 errors on package installs",
            status: "degraded",
            impact: "minor",
            createdAt: now(),
          },
        ]
      );
      result = setVendorStatus(
        result,
        "sentry",
        "degraded",
        "Delayed Ingestion",
        ["Ingest"],
        [
          {
            id: "sentry-deg-1",
            title: "Event ingestion delays of 5-10 minutes",
            status: "degraded",
            impact: "minor",
            createdAt: now(),
          },
        ]
      );
      result = setVendorStatus(
        result,
        "supabase",
        "maintenance",
        "Database Maintenance",
        ["Database"],
        [
          {
            id: "supa-maint-1",
            title: "Postgres 16 upgrade rolling out",
            status: "maintenance",
            impact: "maintenance",
            createdAt: now(),
          },
        ]
      );
      return result;
    },
  },
};

// Active scenario state
let _currentStates: MockVendorState[] = createDefaultVendorStates();
let _currentScenarioName = "all-green";

export function getCurrentStates(): MockVendorState[] {
  return _currentStates;
}

export function getCurrentScenarioName(): string {
  return _currentScenarioName;
}

export function applyScenario(name: string): MockVendorState[] {
  const scenario = scenarios[name];
  if (!scenario) throw new Error(`Unknown scenario: ${name}`);
  _currentStates = scenario.apply(createDefaultVendorStates());
  _currentScenarioName = name;
  return _currentStates;
}

export function setVendorOverride(vendorId: string, status: NormalizedStatusType): void {
  _currentStates = _currentStates.map((s) =>
    s.vendorId === vendorId ? { ...s, status, description: `Manual override: ${status}` } : s
  );
}

export function listScenarios() {
  return Object.entries(scenarios).map(([key, s]) => ({
    id: key,
    name: s.name,
    description: s.description,
  }));
}
