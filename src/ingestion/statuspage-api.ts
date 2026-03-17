import type { SourceAdapter } from "../lib/adapters.js";
import {
  normalizeStatuspageIndicator,
  normalizeStatuspageComponentStatus,
} from "../lib/normalize.js";
import type {
  ServiceStatus,
  ComponentStatus,
  Incident,
  NormalizedStatusType,
} from "../lib/types.js";

interface StatuspageResponse {
  page: { id: string; name: string; url: string };
  status: { indicator: string; description: string };
  components?: Array<{
    id: string;
    name: string;
    status: string;
    description: string | null;
    group_id: string | null;
  }>;
  incidents?: Array<{
    id: string;
    name: string;
    status: string;
    impact: string;
    shortlink: string;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    incident_updates: Array<{
      id: string;
      status: string;
      body: string;
      created_at: string;
    }>;
  }>;
}

export async function fetchStatuspageSummary(
  url: string,
  vendorId: string
): Promise<{
  status: ServiceStatus;
  incidents: Incident[];
}> {
  const resp = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    throw new Error(`Statuspage fetch failed: ${resp.status} ${resp.statusText}`);
  }

  const data: StatuspageResponse = await resp.json();

  const components: ComponentStatus[] = (data.components ?? [])
    .filter((c) => !c.group_id) // skip sub-groups
    .map((c) => ({
      name: c.name,
      status: normalizeStatuspageComponentStatus(c.status),
      description: c.description ?? undefined,
    }));

  const serviceStatus: ServiceStatus = {
    vendorId,
    status: normalizeStatuspageIndicator(data.status.indicator),
    description: data.status.description,
    lastCheckedAt: new Date().toISOString(),
    components,
  };

  const incidents: Incident[] = (data.incidents ?? []).map((inc) => ({
    id: `${vendorId}-${inc.id}`,
    vendorId,
    externalId: inc.id,
    title: inc.name,
    status: normalizeStatuspageIndicator(inc.impact) as NormalizedStatusType,
    impact: inc.impact,
    shortlink: inc.shortlink,
    createdAt: inc.created_at,
    updatedAt: inc.updated_at,
    resolvedAt: inc.resolved_at ?? undefined,
    updates: inc.incident_updates.map((u) => ({
      id: u.id,
      incidentId: `${vendorId}-${inc.id}`,
      status: u.status,
      body: u.body,
      createdAt: u.created_at,
    })),
  }));

  return { status: serviceStatus, incidents };
}

/** Source adapter for Atlassian Statuspage API. */
export const statuspageAdapter: SourceAdapter = {
  type: "statuspage-api",
  fetch: (url, vendorId) => fetchStatuspageSummary(url, vendorId),
};
