import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  createBoardAlertTarget,
  deleteBoardAlertTarget,
  listBoardAlertTargets,
} from "../../db/board-queries.js";
import { db } from "../../db/client.js";
import { boardAlertTargets } from "../../db/schema.js";
import { config } from "../../lib/config.js";

export const boardAlertsRoutes = new Hono();

const createAlertSchema = z.object({
  type: z.enum(["slack", "webhook", "teams"]),
  name: z.string().min(1),
  url: z.string().url(),
  secret: z.string().optional(),
  filterMonitorIds: z.array(z.string()).optional(),
});

/** List alert targets for a board. */
boardAlertsRoutes.get("/", (c) => {
  const boardId = c.req.param("boardId") as string;
  const alerts = listBoardAlertTargets(boardId);
  return c.json({ alerts });
});

/** Create alert target on a board. */
boardAlertsRoutes.post("/", async (c) => {
  const boardId = c.req.param("boardId") as string;
  const body = await c.req.json();
  const parsed = createAlertSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);

  const id = createBoardAlertTarget({ boardId, ...parsed.data });
  return c.json({ ok: true, id }, 201);
});

/** Update alert target. */
boardAlertsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const allowed: Record<string, unknown> = {};
  if (body.name !== undefined) allowed.name = body.name;
  if (body.url !== undefined) allowed.url = body.url;
  if (body.type !== undefined) allowed.type = body.type;
  if (body.enabled !== undefined) allowed.enabled = body.enabled;
  db.update(boardAlertTargets).set(allowed).where(eq(boardAlertTargets.id, id)).run();
  return c.json({ ok: true });
});

/** Delete alert target. */
boardAlertsRoutes.delete("/:id", (c) => {
  deleteBoardAlertTarget(c.req.param("id"));
  return c.json({ ok: true });
});

/** Send test alert. */
boardAlertsRoutes.post("/:id/test", async (c) => {
  const id = c.req.param("id");
  try {
    const resp = await fetch(`${config.RESTATE_INGRESS_URL}/alerter/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: id }),
    });
    const result = await resp.json();
    return c.json(result);
  } catch (err: unknown) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
