import { desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/client.js";
import { services, incidents } from "../../db/schema.js";
import { getAggregateStatus } from "../helpers/status-aggregator.js";

export const publicStatusRoutes = new Hono();

/** Aggregate status overview (public, no auth). */
publicStatusRoutes.get("/status", async (c) => {
  return c.json(getAggregateStatus());
});

/** List enabled services (public, no auth). */
publicStatusRoutes.get("/services", async (c) => {
  const rows = db.select().from(services).where(eq(services.enabled, true)).all();
  return c.json({ services: rows });
});

/** List active incidents (public, no auth). */
publicStatusRoutes.get("/incidents", async (c) => {
  const rows = db
    .select()
    .from(incidents)
    .where(isNull(incidents.resolvedAt))
    .orderBy(desc(incidents.updatedAt))
    .all();
  return c.json({ incidents: rows });
});
