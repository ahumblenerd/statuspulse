import { randomUUID } from "crypto";
import { listBoardMonitors } from "../db/board-queries.js";
import { db } from "../db/client.js";
import { observations, statusChanges } from "../db/schema.js";
import type { NormalizedStatusType } from "../lib/types.js";

/**
 * Generate realistic status history for a board over the past N days.
 * Creates statusChanges + observations entries with plausible patterns:
 * - Most time operational
 * - 2-5 incidents per service per month
 * - Each incident lasts 15min to 4hrs
 */
export function seedHistory(boardId: string, days = 30): number {
  const monitors = listBoardMonitors(boardId);
  let count = 0;
  const now = Date.now();
  const start = now - days * 24 * 60 * 60 * 1000;

  for (const monitor of monitors) {
    if (!monitor.providerServiceId) continue;

    // Generate 2-5 incidents per month-period
    const incidentCount = 2 + Math.floor(Math.random() * 4);
    const usedTimes = new Set<number>();

    for (let i = 0; i < incidentCount; i++) {
      // Random time within the window, avoid collisions
      let incTime: number;
      do {
        incTime = start + Math.floor(Math.random() * (now - start));
      } while (usedTimes.has(Math.floor(incTime / 3600000)));
      usedTimes.add(Math.floor(incTime / 3600000));

      // Random severity: 60% degraded, 25% outage, 15% maintenance
      const roll = Math.random();
      const status: NormalizedStatusType =
        roll < 0.6 ? "degraded" : roll < 0.85 ? "outage" : "maintenance";

      // Duration: 15min to 4hrs
      const duration = (15 + Math.floor(Math.random() * 225)) * 60 * 1000;
      const resolveTime = incTime + duration;

      // Write the "went bad" change
      const downId = randomUUID();
      db.insert(statusChanges)
        .values({
          id: downId,
          serviceId: monitor.providerServiceId,
          previousStatus: "operational",
          newStatus: status,
          changedAt: new Date(incTime).toISOString(),
        })
        .run();

      db.insert(observations)
        .values({
          id: randomUUID(),
          boardMonitorId: monitor.id,
          serviceId: monitor.providerServiceId,
          source: "mock",
          previousStatus: "operational",
          newStatus: status,
          observedAt: new Date(incTime).toISOString(),
        })
        .run();

      // Write the recovery
      db.insert(statusChanges)
        .values({
          id: randomUUID(),
          serviceId: monitor.providerServiceId,
          previousStatus: status,
          newStatus: "operational",
          changedAt: new Date(resolveTime).toISOString(),
        })
        .run();

      db.insert(observations)
        .values({
          id: randomUUID(),
          boardMonitorId: monitor.id,
          serviceId: monitor.providerServiceId,
          source: "mock",
          previousStatus: status,
          newStatus: "operational",
          observedAt: new Date(resolveTime).toISOString(),
        })
        .run();

      count += 2;
    }
  }

  return count;
}
