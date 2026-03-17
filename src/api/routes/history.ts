import { eq, and, gte, desc } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/client.js";
import { statusChanges, services } from "../../db/schema.js";
import { worstStatus } from "../../lib/normalize.js";
import type { NormalizedStatusType } from "../../lib/types.js";

export const historyRoutes = new Hono();

/** Compare two statuses and return the worse one. */
function worseOf(a: string, b: string): string {
  return worstStatus([a as NormalizedStatusType, b as NormalizedStatusType]);
}

/**
 * GET /history/:serviceId
 * Returns status-change history & uptime stats for a service.
 */
historyRoutes.get("/:serviceId", async (c) => {
  const serviceId = c.req.param("serviceId");
  const days = Math.min(Number(c.req.query("days") ?? 30), 365);

  const service = db.select().from(services).where(eq(services.id, serviceId)).get();
  if (!service) {
    return c.json({ error: "Service not found" }, 404);
  }

  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const changes = db
    .select()
    .from(statusChanges)
    .where(and(eq(statusChanges.serviceId, serviceId), gte(statusChanges.changedAt, since)))
    .orderBy(desc(statusChanges.changedAt))
    .all();

  const { percentage, lastOutage } = calcUptime(changes, since, service.status);
  const dailyUptime = calcDailyUptime(changes, days, since, service.status);

  return c.json({
    changes: changes.map((ch) => ({
      previousStatus: ch.previousStatus,
      newStatus: ch.newStatus,
      changedAt: ch.changedAt,
    })),
    uptime: {
      percentage: Math.round(percentage * 10000) / 10000,
      totalChanges: changes.length,
      lastOutage,
    },
    dailyUptime,
  });
});

/** Calculate overall uptime percentage for the period. */
function calcUptime(
  changes: { previousStatus: string; newStatus: string; changedAt: string }[],
  since: string,
  currentStatus: string
): { percentage: number; lastOutage: string | null } {
  const periodStart = new Date(since).getTime();
  const now = Date.now();
  const totalMs = now - periodStart;
  if (totalMs <= 0) return { percentage: 100, lastOutage: null };

  // Walk forward through changes (oldest first)
  const sorted = [...changes].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  );

  let operationalMs = 0;
  let lastOutage: string | null = null;
  let cursor = periodStart;
  // Status at period start: if we have a first change, its previousStatus tells us
  let status = sorted.length > 0 ? sorted[0].previousStatus : currentStatus;

  for (const ch of sorted) {
    const changeTime = new Date(ch.changedAt).getTime();
    if (status === "operational") {
      operationalMs += changeTime - cursor;
    }
    if (ch.newStatus === "outage") {
      lastOutage = ch.changedAt;
    }
    status = ch.newStatus;
    cursor = changeTime;
  }

  // Remaining time until now
  if (status === "operational") {
    operationalMs += now - cursor;
  }

  return { percentage: (operationalMs / totalMs) * 100, lastOutage };
}

/** Bucket daily uptime, returning worst status per day. */
function calcDailyUptime(
  changes: { previousStatus: string; newStatus: string; changedAt: string }[],
  days: number,
  since: string,
  currentStatus: string
): { date: string; uptimePercent: number; status: string }[] {
  const sorted = [...changes].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  );

  const result: { date: string; uptimePercent: number; status: string }[] = [];
  const startDate = new Date(since);
  startDate.setUTCHours(0, 0, 0, 0);

  for (let d = 0; d < days; d++) {
    const dayStart = new Date(startDate.getTime() + d * 86_400_000);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const nowMs = Date.now();
    const effectiveEnd = Math.min(dayEnd.getTime(), nowMs);
    if (dayStart.getTime() >= nowMs) break;

    const dayChanges = sorted.filter((ch) => {
      const t = new Date(ch.changedAt).getTime();
      return t >= dayStart.getTime() && t < effectiveEnd;
    });

    // Determine status at start of day
    const prior = sorted.filter((ch) => new Date(ch.changedAt).getTime() < dayStart.getTime());
    const statusAtDayStart =
      prior.length > 0
        ? prior[prior.length - 1].newStatus
        : (sorted[0]?.previousStatus ?? currentStatus);

    let opMs = 0;
    let cursor = dayStart.getTime();
    let worst = statusAtDayStart;
    let status = statusAtDayStart;

    for (const ch of dayChanges) {
      const t = new Date(ch.changedAt).getTime();
      if (status === "operational") opMs += t - cursor;
      worst = worseOf(worst, ch.newStatus);
      status = ch.newStatus;
      cursor = t;
    }
    if (status === "operational") opMs += effectiveEnd - cursor;

    const totalDayMs = effectiveEnd - dayStart.getTime();
    const pct = totalDayMs > 0 ? Math.round((opMs / totalDayMs) * 10000) / 100 : 100;
    const dateStr = dayStart.toISOString().slice(0, 10);
    result.push({ date: dateStr, uptimePercent: pct, status: worst });
  }

  return result;
}
