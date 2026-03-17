import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  createBoardMonitor,
  deleteBoardMonitor,
  getBoardMonitor,
  listBoardMonitors,
  updateBoardMonitor,
} from "../../db/board-queries.js";
import { db } from "../../db/client.js";
import { computeMonitorStatus } from "../../db/observation-queries.js";
import { components } from "../../db/schema.js";

export const boardMonitorsRoutes = new Hono();

const createMonitorSchema = z.object({
  name: z.string().min(1),
  monitorType: z.string().optional(),
  providerServiceId: z.string().optional(),
  selectionMode: z.enum(["all", "include_only", "exclude"]).optional(),
  selectedComponentIds: z.array(z.string()).optional(),
  displayOrder: z.number().optional(),
});

const patchMonitorSchema = z
  .object({
    name: z.string().min(1).optional(),
    selectionMode: z.enum(["all", "include_only", "exclude"]).optional(),
    selectedComponentIds: z.array(z.string()).nullable().optional(),
    enabled: z.boolean().optional(),
    showOnStatusPage: z.boolean().optional(),
    displayOrder: z.number().optional(),
  })
  .strict();

/** List monitors for a board with computed status. */
boardMonitorsRoutes.get("/", (c) => {
  const boardId = c.req.param("boardId") as string;
  const monitors = listBoardMonitors(boardId);
  const result = monitors.map((m) => ({
    ...m,
    computedStatus: computeMonitorStatus(m),
  }));
  return c.json({ monitors: result });
});

/** Add a monitor to a board. */
boardMonitorsRoutes.post("/", async (c) => {
  const boardId = c.req.param("boardId") as string;
  const body = await c.req.json();
  const parsed = createMonitorSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);

  const id = createBoardMonitor({ boardId, ...parsed.data });
  return c.json({ ok: true, id }, 201);
});

/** Update a monitor (verifies board ownership). */
boardMonitorsRoutes.patch("/:id", async (c) => {
  const boardId = c.req.param("boardId") as string;
  const id = c.req.param("id");
  const monitor = getBoardMonitor(id);
  if (!monitor || monitor.boardId !== boardId) return c.json({ error: "Monitor not found" }, 404);

  const body = await c.req.json();
  const parsed = patchMonitorSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);

  updateBoardMonitor(id, parsed.data);
  return c.json({ ok: true });
});

/** Delete a monitor (verifies board ownership). */
boardMonitorsRoutes.delete("/:id", (c) => {
  const boardId = c.req.param("boardId") as string;
  const id = c.req.param("id");
  const monitor = getBoardMonitor(id);
  if (!monitor || monitor.boardId !== boardId) return c.json({ error: "Monitor not found" }, 404);
  deleteBoardMonitor(id);
  return c.json({ ok: true });
});

/** List available components for a monitor (for component selection UI). */
boardMonitorsRoutes.get("/:id/components", (c) => {
  const monitor = getBoardMonitor(c.req.param("id"));
  if (!monitor) return c.json({ error: "Monitor not found" }, 404);
  if (!monitor.providerServiceId) return c.json({ components: [] });

  const comps = db
    .select()
    .from(components)
    .where(eq(components.serviceId, monitor.providerServiceId))
    .all();

  const selected: string[] = monitor.selectedComponentIds
    ? JSON.parse(monitor.selectedComponentIds)
    : [];

  return c.json({
    components: comps.map((comp) => ({
      ...comp,
      selected: selected.includes(comp.id),
    })),
    selectionMode: monitor.selectionMode,
  });
});
