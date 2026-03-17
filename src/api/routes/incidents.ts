import { desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/client.js";
import { incidents, incidentUpdates } from "../../db/schema.js";

export const incidentsRoutes = new Hono();

// List incidents (active by default)
incidentsRoutes.get("/", async (c) => {
  const active = c.req.query("active") !== "false";
  const vendorId = c.req.query("vendor");
  const region = c.req.query("region");
  const rawLimit = parseInt(c.req.query("limit") ?? "50", 10);
  const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 500);

  let rows = active
    ? db
        .select()
        .from(incidents)
        .where(isNull(incidents.resolvedAt))
        .orderBy(desc(incidents.updatedAt))
        .all()
    : db.select().from(incidents).orderBy(desc(incidents.updatedAt)).all();

  if (vendorId) {
    rows = rows.filter((r) => r.serviceId === vendorId);
  }
  if (region) {
    rows = rows.filter((r) => r.region === region);
  }

  rows = rows.slice(0, limit);

  return c.json({ incidents: rows });
});

// Get single incident with updates
incidentsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const incident = db.select().from(incidents).where(eq(incidents.id, id)).get();

  if (!incident) {
    return c.json({ error: "Incident not found" }, 404);
  }

  const updates = db
    .select()
    .from(incidentUpdates)
    .where(eq(incidentUpdates.incidentId, id))
    .orderBy(desc(incidentUpdates.createdAt))
    .all();

  return c.json({ incident, updates });
});
