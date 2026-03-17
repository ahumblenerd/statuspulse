import { eq, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import { services, incidents } from "../../db/schema.js";
import { worstStatus } from "../../lib/normalize.js";
import type { NormalizedStatusType } from "../../lib/types.js";

export interface AggregateStatus {
  status: NormalizedStatusType;
  totalServices: number;
  activeIncidents: number;
  staleServices: number;
  byCategory: Record<string, { status: NormalizedStatusType; count: number }>;
  byRegion: Record<string, { status: NormalizedStatusType; count: number }>;
  lastUpdated: string;
}

/** Build the aggregate status overview, optionally filtered by region. */
export function getAggregateStatus(region?: string): AggregateStatus {
  let allServices = db.select().from(services).where(eq(services.enabled, true)).all();
  if (region) {
    allServices = allServices.filter((s) => s.region === region);
  }

  const activeIncs = db.select().from(incidents).where(isNull(incidents.resolvedAt)).all();
  const overall = worstStatus(allServices.map((s) => s.status as NormalizedStatusType));

  const byCategory: Record<string, { status: NormalizedStatusType; count: number }> = {};
  for (const s of allServices) {
    if (!byCategory[s.category]) {
      byCategory[s.category] = { status: s.status as NormalizedStatusType, count: 0 };
    }
    byCategory[s.category].count++;
    const catStatuses = allServices
      .filter((x) => x.category === s.category)
      .map((x) => x.status as NormalizedStatusType);
    byCategory[s.category].status = worstStatus(catStatuses);
  }

  const regions = [...new Set(allServices.map((s) => s.region ?? "global"))];
  const byRegion: Record<string, { status: NormalizedStatusType; count: number }> = {};
  for (const r of regions) {
    const regionServices = allServices.filter((s) => (s.region ?? "global") === r);
    byRegion[r] = {
      status: worstStatus(regionServices.map((s) => s.status as NormalizedStatusType)),
      count: regionServices.length,
    };
  }

  const staleThresholdMs = 5 * 60 * 1000;
  const now = Date.now();
  const staleServices = allServices.filter((s) => {
    if (!s.lastCheckedAt) return true;
    return now - new Date(s.lastCheckedAt).getTime() > staleThresholdMs;
  }).length;

  return {
    status: overall,
    totalServices: allServices.length,
    activeIncidents: activeIncs.length,
    staleServices,
    byCategory,
    byRegion,
    lastUpdated: new Date().toISOString(),
  };
}
