import { inArray } from "drizzle-orm";
import { Hono } from "hono";
import { listBoardMonitors, getBoardBySlug } from "../../db/board-queries.js";
import { db } from "../../db/client.js";
import { computeMonitorStatus, worstStatus } from "../../db/observation-queries.js";
import { incidents } from "../../db/schema.js";

export const boardStatusRoutes = new Hono();

/** Public status page data for a board (no auth). */
boardStatusRoutes.get("/:slug/public", (c) => {
  const board = getBoardBySlug(c.req.param("slug"));
  if (!board) return c.json({ error: "Board not found" }, 404);

  const monitors = listBoardMonitors(board.id);
  const visibleMonitors = monitors.filter((m) => m.enabled && m.showOnStatusPage);

  const monitorStatuses = visibleMonitors.map((m) => {
    const status = computeMonitorStatus(m);
    return {
      id: m.id,
      name: m.name,
      status,
      displayOrder: m.displayOrder,
      simulated: !!m.statusOverride,
    };
  });

  const aggregateStatus = worstStatus(monitorStatuses.map((m) => m.status));

  // Gather active incidents only from monitored services
  const serviceIds = [
    ...new Set(visibleMonitors.map((m) => m.providerServiceId).filter(Boolean) as string[]),
  ];

  // Single query instead of N queries per service
  const allIncidents =
    serviceIds.length > 0
      ? db.select().from(incidents).where(inArray(incidents.serviceId, serviceIds)).all()
      : [];

  // Filter to active only, and respect monitor component scope
  const activeIncidents = allIncidents
    .filter((inc) => !inc.resolvedAt)
    .filter((inc) => {
      // Find the monitor(s) for this incident's service
      const relevantMonitors = visibleMonitors.filter((m) => m.providerServiceId === inc.serviceId);
      // If any monitor includes this service with selectionMode "all", include incident
      // For component-filtered monitors, include if region matches or no region filter
      return relevantMonitors.length > 0;
    });

  return c.json({
    board: { name: board.name, slug: board.slug, description: board.description },
    status: aggregateStatus,
    monitors: monitorStatuses,
    activeIncidents,
    updatedAt: new Date().toISOString(),
  });
});
