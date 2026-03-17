import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import type { Incident, ServiceStatus } from "../lib/types.js";
import { db } from "./client.js";
import {
  services,
  incidents,
  incidentUpdates,
  components,
  statusChanges,
  probeResults,
} from "./schema.js";

/** Read the current persisted status for a vendor. */
export function getPreviousStatus(vendorId: string): string | null {
  const row = db
    .select({ status: services.status })
    .from(services)
    .where(eq(services.vendorId, vendorId))
    .get();
  return row?.status ?? null;
}

/** Upsert service status. Records a status_change when the status transitions. */
export function persistStatus(
  vendorId: string,
  status: ServiceStatus,
  name?: string,
  category?: string,
  statusPageUrl?: string
) {
  const existing = db.select().from(services).where(eq(services.vendorId, vendorId)).get();

  if (existing) {
    const changed = existing.status !== status.status;
    db.update(services)
      .set({
        status: status.status,
        description: status.description,
        lastCheckedAt: status.lastCheckedAt,
        ...(changed ? { lastChangedAt: new Date().toISOString() } : {}),
      })
      .where(eq(services.vendorId, vendorId))
      .run();

    // Record the transition in history (use existing.id, not vendorId, for FK)
    if (changed) {
      db.insert(statusChanges)
        .values({
          id: randomUUID(),
          serviceId: existing.id,
          previousStatus: existing.status,
          newStatus: status.status,
          changedAt: new Date().toISOString(),
        })
        .run();
    }
  } else {
    db.insert(services)
      .values({
        id: vendorId,
        vendorId,
        name: name ?? vendorId,
        category: category ?? "other",
        status: status.status,
        description: status.description,
        statusPageUrl: statusPageUrl ?? null,
        lastCheckedAt: status.lastCheckedAt,
      })
      .onConflictDoUpdate({
        target: services.id,
        set: {
          status: status.status,
          description: status.description,
          lastCheckedAt: status.lastCheckedAt,
        },
      })
      .run();
  }
}

/** Upsert component statuses for a service. */
export function persistComponents(vendorId: string, comps: ServiceStatus["components"]) {
  if (!comps) {
    return;
  }
  for (const comp of comps) {
    const id = `${vendorId}-${comp.name.toLowerCase().replace(/\s+/g, "-")}`;
    db.insert(components)
      .values({
        id,
        serviceId: vendorId,
        name: comp.name,
        status: comp.status,
        description: comp.description ?? "",
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: components.id,
        set: {
          status: comp.status,
          description: comp.description ?? "",
          updatedAt: new Date().toISOString(),
        },
      })
      .run();
  }
}

/** Upsert incidents and their update timeline entries. */
export function persistIncidents(vendorId: string, incs: Incident[]) {
  for (const inc of incs) {
    db.insert(incidents)
      .values({
        id: inc.id,
        serviceId: vendorId,
        externalId: inc.externalId,
        title: inc.title,
        status: inc.status,
        impact: inc.impact,
        shortlink: inc.shortlink,
        createdAt: inc.createdAt,
        updatedAt: inc.updatedAt,
        resolvedAt: inc.resolvedAt,
      })
      .onConflictDoUpdate({
        target: incidents.id,
        set: { status: inc.status, updatedAt: inc.updatedAt, resolvedAt: inc.resolvedAt },
      })
      .run();

    if (inc.updates) {
      for (const upd of inc.updates) {
        db.insert(incidentUpdates)
          .values({
            id: upd.id,
            incidentId: inc.id,
            status: upd.status,
            body: upd.body,
            createdAt: upd.createdAt,
          })
          .onConflictDoNothing()
          .run();
      }
    }
  }
}

/** Record a synthetic probe result. */
export function persistProbeResult(
  serviceId: string,
  url: string,
  result: { httpStatus?: number; latencyMs?: number; ok: boolean; error?: string }
) {
  db.insert(probeResults)
    .values({
      id: randomUUID(),
      serviceId,
      url,
      httpStatus: result.httpStatus,
      latencyMs: result.latencyMs,
      ok: result.ok,
      error: result.error,
      checkedAt: new Date().toISOString(),
    })
    .run();
}
