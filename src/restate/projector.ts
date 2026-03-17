import { eq } from "drizzle-orm";
import { listBoardAlertTargets } from "../db/board-queries.js";
import { db } from "../db/client.js";
import { computeMonitorStatus, recordObservation } from "../db/observation-queries.js";
import { boardMonitors } from "../db/schema.js";
import type { NormalizedStatusType, StatusChangeEvent } from "../lib/types.js";

export interface MonitorChangeEvent {
  event: StatusChangeEvent;
  monitorId: string;
  boardId: string;
  /** Board-scoped alert targets that should be notified. */
  boardAlertTargets: Array<{ type: string; url: string; secret: string | null }>;
}

/** In-memory cache of last-known monitor statuses. */
const monitorStatusCache = new Map<string, string>();

/**
 * After canonical provider data updates, project changes to board monitors.
 * Returns change events with resolved board alert targets.
 */
export function projectServiceUpdate(serviceId: string, vendorName: string): MonitorChangeEvent[] {
  const monitors = db
    .select()
    .from(boardMonitors)
    .where(eq(boardMonitors.providerServiceId, serviceId))
    .all();

  const changes: MonitorChangeEvent[] = [];

  for (const monitor of monitors) {
    const newStatus = computeMonitorStatus(monitor);
    const prevStatus = monitorStatusCache.get(monitor.id) ?? "operational";

    if (newStatus !== prevStatus) {
      monitorStatusCache.set(monitor.id, newStatus);

      recordObservation({
        boardMonitorId: monitor.id,
        serviceId,
        source: "official",
        previousStatus: prevStatus,
        newStatus,
      });

      const targets = getBoardAlertTargetsForMonitor(monitor.id, monitor.boardId);

      changes.push({
        event: {
          vendorId: serviceId,
          vendorName,
          previousStatus: prevStatus as NormalizedStatusType,
          currentStatus: newStatus,
          description: `Monitor "${monitor.name}": ${prevStatus} → ${newStatus}`,
          timestamp: new Date().toISOString(),
        },
        monitorId: monitor.id,
        boardId: monitor.boardId,
        boardAlertTargets: targets,
      });
    }
  }

  return changes;
}

/** Get board-scoped alert targets for a monitor change. */
function getBoardAlertTargetsForMonitor(monitorId: string, boardId: string) {
  const targets = listBoardAlertTargets(boardId);
  return targets
    .filter((t) => {
      if (!t.enabled) return false;
      if (!t.filterMonitorIds) return true;
      const filterIds: string[] = JSON.parse(t.filterMonitorIds);
      return filterIds.includes(monitorId);
    })
    .map((t) => ({ type: t.type, url: t.url, secret: t.secret }));
}

/**
 * Warm the cache on startup so the first poll doesn't trigger false alerts.
 * Call after DB is initialized.
 */
export function warmProjectorCache(): void {
  const allMonitors = db.select().from(boardMonitors).all();
  for (const m of allMonitors) {
    monitorStatusCache.set(m.id, computeMonitorStatus(m));
  }
}

/** Reset the in-memory status cache (useful for tests). */
export function resetProjectorCache(): void {
  monitorStatusCache.clear();
}
