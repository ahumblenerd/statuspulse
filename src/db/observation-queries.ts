import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import type { NormalizedStatusType } from "../lib/types.js";
import { db } from "./client.js";
import { components, observations, services } from "./schema.js";

// ── Observations ──────────────────────────────────────────────────

/** Record an observation (status change on a board monitor). */
export function recordObservation(opts: {
  boardMonitorId?: string;
  serviceId?: string;
  componentId?: string;
  source: string;
  previousStatus: string;
  newStatus: string;
}): string {
  const id = randomUUID();
  db.insert(observations)
    .values({ id, ...opts, observedAt: new Date().toISOString() })
    .run();
  return id;
}

/** List recent observations for a board monitor. */
export function listObservations(boardMonitorId: string, limit = 50) {
  return db
    .select()
    .from(observations)
    .where(eq(observations.boardMonitorId, boardMonitorId))
    .orderBy(desc(observations.observedAt))
    .limit(limit)
    .all();
}

// ── Monitor Status Computation ────────────────────────────────────

const STATUS_PRIORITY: Record<string, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  outage: 3,
};

/** Compute worst status from a list. */
export function worstStatus(statuses: string[]): NormalizedStatusType {
  if (statuses.length === 0) return "operational";
  return statuses.reduce((worst, s) =>
    (STATUS_PRIORITY[s] ?? 0) > (STATUS_PRIORITY[worst] ?? 0) ? s : worst
  ) as NormalizedStatusType;
}

/** Get the service-level status as fallback. */
function getServiceStatus(serviceId: string): NormalizedStatusType {
  const svc = db
    .select({ status: services.status })
    .from(services)
    .where(eq(services.id, serviceId))
    .get();
  return (svc?.status as NormalizedStatusType) ?? "operational";
}

/** Compute a monitor's filtered status based on its selection mode. */
export function computeMonitorStatus(monitor: {
  providerServiceId: string | null;
  selectionMode: string;
  selectedComponentIds: string | null;
  statusOverride?: string | null;
}): NormalizedStatusType {
  // Monitor-scoped override takes priority (used by simulation)
  if (monitor.statusOverride) return monitor.statusOverride as NormalizedStatusType;

  if (!monitor.providerServiceId) return "operational";

  const comps = db
    .select()
    .from(components)
    .where(eq(components.serviceId, monitor.providerServiceId))
    .all();

  // No components? Fall back to service-level status
  if (comps.length === 0) return getServiceStatus(monitor.providerServiceId);

  const selected = monitor.selectedComponentIds
    ? (JSON.parse(monitor.selectedComponentIds) as string[])
    : null;

  let filtered = comps;
  if (monitor.selectionMode === "include_only" && selected) {
    filtered = comps.filter((c) => selected.includes(c.id));
  } else if (monitor.selectionMode === "exclude" && selected) {
    filtered = comps.filter((c) => !selected.includes(c.id));
  }

  // If filter resolves to empty, fall back to service status
  if (filtered.length === 0) return getServiceStatus(monitor.providerServiceId);

  return worstStatus(filtered.map((c) => c.status));
}
