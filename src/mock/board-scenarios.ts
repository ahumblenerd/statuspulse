import { eq } from "drizzle-orm";
import {
  clearBoardOverrides,
  clearMonitorOverride,
  listBoardMonitors,
  setMonitorOverride,
} from "../db/board-queries.js";
import { db } from "../db/client.js";
import { recordObservation, computeMonitorStatus } from "../db/observation-queries.js";
import { services } from "../db/schema.js";
import type { NormalizedStatusType } from "../lib/types.js";
import { applyScenario } from "./scenarios.js";

/**
 * Apply a mock scenario at the board level.
 * Sets statusOverride on each affected monitor — does NOT mutate canonical tables.
 */
export function applyBoardScenario(
  boardId: string,
  scenarioName: string
): {
  applied: string;
  changes: Array<{ monitorName: string; from: string; to: string }>;
} {
  const monitors = listBoardMonitors(boardId);

  // Capture pre-scenario statuses
  const before = new Map<string, string>();
  for (const m of monitors) {
    before.set(m.id, computeMonitorStatus(m));
  }

  // Apply scenario to get desired vendor states
  const states = applyScenario(scenarioName);

  // Clear previous overrides
  clearBoardOverrides(boardId);

  // Set overrides on monitors whose vendor is affected
  for (const m of monitors) {
    if (!m.providerServiceId) continue;
    const svc = db.select().from(services).where(eq(services.id, m.providerServiceId)).get();
    if (!svc) continue;

    const state = states.find((s) => s.vendorId === svc.vendorId);
    if (state && state.status !== "operational") {
      setMonitorOverride(m.id, state.status);
    }
  }

  // Record observations for changes
  const changes: Array<{ monitorName: string; from: string; to: string }> = [];
  const updatedMonitors = listBoardMonitors(boardId);
  for (const m of updatedMonitors) {
    const newStatus = computeMonitorStatus(m);
    const oldStatus = before.get(m.id) ?? "operational";
    if (newStatus !== oldStatus) {
      recordObservation({
        boardMonitorId: m.id,
        serviceId: m.providerServiceId ?? undefined,
        source: "mock",
        previousStatus: oldStatus,
        newStatus,
      });
      changes.push({ monitorName: m.name, from: oldStatus, to: newStatus });
    }
  }

  return { applied: scenarioName, changes };
}

/** Override a single monitor's status (scoped, no canonical mutation). */
export function setMonitorSimStatus(monitorId: string, status: NormalizedStatusType): void {
  setMonitorOverride(monitorId, status);
}

/** Reset a monitor to computed status (clear override). */
export function resetMonitorSimStatus(monitorId: string): void {
  clearMonitorOverride(monitorId);
}

/** Reset all overrides on a board. */
export function resetBoardSimulation(boardId: string): void {
  clearBoardOverrides(boardId);
}
