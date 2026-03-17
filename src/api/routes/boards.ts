import { Hono } from "hono";
import { z } from "zod";
import {
  createBoard,
  listBoards,
  getBoardById,
  updateBoard,
  deleteBoard,
  listBoardMonitors,
  createBoardMonitor,
} from "../../db/board-queries.js";
import { computeMonitorStatus, worstStatus } from "../../db/observation-queries.js";

export const boardsRoutes = new Hono();

const createBoardSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
});

const patchBoardSchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    description: z.string().optional(),
  })
  .strict();

/** List all boards with computed status and monitor count. */
boardsRoutes.get("/", (c) => {
  const allBoards = listBoards();
  const enriched = allBoards.map((board) => {
    const monitors = listBoardMonitors(board.id);
    const statuses = monitors.map((m) => computeMonitorStatus(m));
    return {
      ...board,
      monitorCount: monitors.length,
      status: worstStatus(statuses),
    };
  });
  return c.json({ boards: enriched });
});

/** Create a new board. */
boardsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createBoardSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
  const id = createBoard(parsed.data);
  return c.json({ ok: true, id }, 201);
});

/** Get board detail with monitors and aggregate status. */
boardsRoutes.get("/:id", (c) => {
  const board = getBoardById(c.req.param("id"));
  if (!board) return c.json({ error: "Board not found" }, 404);

  const monitors = listBoardMonitors(board.id);
  const monitorStatuses = monitors.map((m) => ({
    ...m,
    computedStatus: computeMonitorStatus(m),
  }));
  const aggregateStatus = worstStatus(monitorStatuses.map((m) => m.computedStatus));

  return c.json({ board, monitors: monitorStatuses, aggregateStatus });
});

/** Update board. */
boardsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const board = getBoardById(id);
  if (!board) return c.json({ error: "Board not found" }, 404);

  const body = await c.req.json();
  const parsed = patchBoardSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);

  updateBoard(id, parsed.data);
  return c.json({ ok: true });
});

/** Delete board (cannot delete default). */
boardsRoutes.delete("/:id", (c) => {
  const deleted = deleteBoard(c.req.param("id"));
  if (!deleted) return c.json({ error: "Cannot delete default board or board not found" }, 400);
  return c.json({ ok: true });
});

/** Duplicate a board with all its monitors. */
boardsRoutes.post("/:id/duplicate", async (c) => {
  const source = getBoardById(c.req.param("id"));
  if (!source) return c.json({ error: "Board not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const suffix = Date.now().toString(36).slice(-4);
  const newName = body.name ?? `${source.name} (Copy)`;
  const newSlug = body.slug ?? `${source.slug}-${suffix}`;

  try {
    const newId = createBoard({
      name: newName,
      slug: newSlug,
      description: source.description ?? undefined,
    });
    const monitors = listBoardMonitors(source.id);

    for (const m of monitors) {
      createBoardMonitor({
        boardId: newId,
        name: m.name,
        monitorType: m.monitorType,
        providerServiceId: m.providerServiceId ?? undefined,
        selectionMode: m.selectionMode,
        selectedComponentIds: m.selectedComponentIds
          ? JSON.parse(m.selectedComponentIds)
          : undefined,
        displayOrder: m.displayOrder,
      });
    }

    return c.json({ ok: true, id: newId }, 201);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Duplicate failed" }, 400);
  }
});
