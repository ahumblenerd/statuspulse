import { Hono } from "hono";
import { getBoardMonitor } from "../../db/board-queries.js";
import type { NormalizedStatusType } from "../../lib/types.js";
import {
  applyBoardScenario,
  resetBoardSimulation,
  resetMonitorSimStatus,
  setMonitorSimStatus,
} from "../../mock/board-scenarios.js";
import { listScenarios } from "../../mock/scenarios.js";
import { seedHistory } from "../../mock/seed-history.js";

export const mockBoardRoutes = new Hono();

/** List available scenarios. */
mockBoardRoutes.get("/scenarios", (c) => {
  return c.json({ scenarios: listScenarios() });
});

/** Apply a scenario to a board (sets overrides, not canonical state). */
mockBoardRoutes.post("/boards/:boardId/scenarios/:name", (c) => {
  const { boardId, name } = c.req.param();
  try {
    const result = applyBoardScenario(boardId, name);
    return c.json({ ok: true, ...result });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

/** Set individual monitor status override (scoped to this monitor only). */
mockBoardRoutes.post("/monitors/:monitorId/status", async (c) => {
  const monitorId = c.req.param("monitorId");
  const { status } = await c.req.json<{ status: NormalizedStatusType }>();
  const monitor = getBoardMonitor(monitorId);
  if (!monitor) return c.json({ error: "Monitor not found" }, 404);
  setMonitorSimStatus(monitorId, status);
  return c.json({ ok: true, monitorId, status });
});

/** Reset a monitor's override (return to real computed status). */
mockBoardRoutes.post("/monitors/:monitorId/reset", (c) => {
  const monitorId = c.req.param("monitorId");
  const monitor = getBoardMonitor(monitorId);
  if (!monitor) return c.json({ error: "Monitor not found" }, 404);
  resetMonitorSimStatus(monitorId);
  return c.json({ ok: true, monitorId, status: "computed" });
});

/** Reset all overrides on a board. */
mockBoardRoutes.post("/boards/:boardId/reset", (c) => {
  const boardId = c.req.param("boardId");
  resetBoardSimulation(boardId);
  return c.json({ ok: true, boardId });
});

/** Seed historical data for a board. */
mockBoardRoutes.post("/seed-history", async (c) => {
  try {
    const { boardId, days } = await c.req.json<{ boardId: string; days?: number }>();
    const count = seedHistory(boardId, days);
    return c.json({ ok: true, observations: count });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
