import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDefaultBoard, createBoardMonitor, listBoardMonitors } from "../../db/board-queries.js";
import { db } from "../../db/client.js";
import { services, components } from "../../db/schema.js";
import { getAllVendors, getVendorById } from "../../vendors/registry.js";

export const servicesRoutes = new Hono();

// List all services with their current status
servicesRoutes.get("/", async (c) => {
  const region = c.req.query("region");
  const category = c.req.query("category");
  const enabledOnly = c.req.query("enabled") !== "false";

  let rows = db.select().from(services).all();

  if (region) {
    rows = rows.filter((r) => r.region === region);
  }
  if (category) {
    rows = rows.filter((r) => r.category === category);
  }
  if (enabledOnly) {
    rows = rows.filter((r) => r.enabled);
  }

  return c.json({ services: rows });
});

// List available vendors from catalog (must be before /:id to avoid shadowing)
servicesRoutes.get("/catalog/all", async (c) => {
  const vendors = getAllVendors();
  return c.json({ vendors });
});

// Get single service with components
servicesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const service = db.select().from(services).where(eq(services.id, id)).get();

  if (!service) {
    return c.json({ error: "Service not found" }, 404);
  }

  const comps = db.select().from(components).where(eq(components.serviceId, id)).all();

  return c.json({ service, components: comps });
});

// Add/enable a vendor
servicesRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { vendorId, region, enabled } = body;

  const vendor = getVendorById(vendorId);
  if (!vendor) {
    return c.json({ error: `Unknown vendor: ${vendorId}` }, 400);
  }

  db.insert(services)
    .values({
      id: region ? `${vendorId}-${region}` : vendorId,
      vendorId,
      name: vendor.name,
      category: vendor.category,
      statusPageUrl: vendor.statusPageUrl,
      region: region ?? "global",
      enabled: enabled ?? true,
    })
    .onConflictDoUpdate({
      target: services.id,
      set: {
        enabled: enabled ?? true,
        region: region ?? "global",
      },
    })
    .run();

  // Auto-add to default board if not already monitored
  const serviceId = region ? `${vendorId}-${region}` : vendorId;
  const defaultBoard = getDefaultBoard();
  if (defaultBoard) {
    const monitors = listBoardMonitors(defaultBoard.id);
    const alreadyMonitored = monitors.some((m) => m.providerServiceId === serviceId);
    if (!alreadyMonitored) {
      createBoardMonitor({
        boardId: defaultBoard.id,
        name: vendor.name,
        monitorType: "provider_service",
        providerServiceId: serviceId,
        displayOrder: monitors.length,
      });
    }
  }

  return c.json({ ok: true, id: vendorId }, 201);
});

// Update service (whitelist allowed fields)
servicesRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const allowed: Partial<{ name: string; category: string; region: string; enabled: boolean }> = {};
  if (body.name !== undefined) allowed.name = body.name;
  if (body.category !== undefined) allowed.category = body.category;
  if (body.region !== undefined) allowed.region = body.region;
  if (body.enabled !== undefined) allowed.enabled = body.enabled;

  db.update(services).set(allowed).where(eq(services.id, id)).run();

  return c.json({ ok: true });
});

// Delete service
servicesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  db.delete(services).where(eq(services.id, id)).run();
  return c.json({ ok: true });
});
