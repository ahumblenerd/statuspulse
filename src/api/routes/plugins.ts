import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/client.js";
import { plugins, services } from "../../db/schema.js";
import { config } from "../../lib/config.js";

export const pluginsRoutes = new Hono();

// List plugins
pluginsRoutes.get("/", async (c) => {
  const rows = db.select().from(plugins).all();
  return c.json({
    plugins: rows.map((r) => ({
      ...r,
      config: JSON.parse(r.config),
    })),
  });
});

// Register a plugin (custom/bespoke status page)
pluginsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const id = body.id ?? randomUUID();

  /*
    Example body:
    {
      "id": "internal-api",
      "name": "Internal API",
      "type": "custom-api",
      "config": {
        "url": "https://internal.example.com/health",
        "headers": { "Authorization": "Bearer xxx" },
        "statusPath": "status.overall",
        "statusMapping": { "healthy": "operational", "unhealthy": "outage" },
        "region": "us-east"
      }
    }
  */

  db.insert(plugins)
    .values({
      id,
      name: body.name,
      type: body.type ?? "custom-api",
      config: JSON.stringify(body.config),
      enabled: body.enabled ?? true,
    })
    .onConflictDoUpdate({
      target: plugins.id,
      set: {
        name: body.name,
        type: body.type ?? "custom-api",
        config: JSON.stringify(body.config),
        enabled: body.enabled ?? true,
      },
    })
    .run();

  // Also create a service entry for it
  db.insert(services)
    .values({
      id,
      vendorId: id,
      name: body.name,
      category: body.category ?? "custom",
      region: body.config?.region ?? "global",
      enabled: true,
    })
    .onConflictDoUpdate({
      target: services.id,
      set: {
        name: body.name,
        category: body.category ?? "custom",
        region: body.config?.region ?? "global",
      },
    })
    .run();

  // Trigger immediate poll via Restate
  try {
    await fetch(`${config.RESTATE_INGRESS_URL}/poller/${id}/pollNow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    // Restate may not be available yet
  }

  return c.json({ ok: true, id }, 201);
});

// Update plugin
pluginsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const updates: Partial<{ name: string; config: string; enabled: boolean }> = {};
  if (body.name) updates.name = body.name;
  if (body.config) updates.config = JSON.stringify(body.config);
  if (body.enabled !== undefined) updates.enabled = body.enabled;

  db.update(plugins).set(updates).where(eq(plugins.id, id)).run();
  return c.json({ ok: true });
});

// Delete plugin
pluginsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  db.delete(plugins).where(eq(plugins.id, id)).run();
  db.delete(services).where(eq(services.id, id)).run();
  return c.json({ ok: true });
});
