import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db/client.js";
import { alertTargets } from "../../db/schema.js";
import { config } from "../../lib/config.js";

export const alertTargetsRoutes = new Hono();

// List all alert targets
alertTargetsRoutes.get("/", async (c) => {
  const targets = db.select().from(alertTargets).all();
  return c.json({ targets });
});

const createTargetSchema = z.object({
  type: z.enum(["slack", "webhook", "teams"]),
  name: z.string().min(1, "name is required"),
  url: z.string().url("url must be a valid URL"),
  secret: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  filterRegion: z.string().optional(),
  filterCategory: z.string().optional(),
});

// Create alert target
alertTargetsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createTargetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
  }

  const id = randomUUID();
  db.insert(alertTargets)
    .values({
      id,
      type: parsed.data.type,
      name: parsed.data.name,
      url: parsed.data.url,
      secret: parsed.data.secret,
      enabled: parsed.data.enabled,
      filterRegion: parsed.data.filterRegion,
      filterCategory: parsed.data.filterCategory,
    })
    .run();

  return c.json({ ok: true, id }, 201);
});

// Delete alert target
alertTargetsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  db.delete(alertTargets).where(eq(alertTargets.id, id)).run();
  return c.json({ ok: true });
});

// Test alert target
alertTargetsRoutes.post("/:id/test", async (c) => {
  const id = c.req.param("id");
  const target = db.select().from(alertTargets).where(eq(alertTargets.id, id)).get();

  if (!target) {
    return c.json({ error: "Target not found" }, 404);
  }

  // Send test via Restate alerter
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
