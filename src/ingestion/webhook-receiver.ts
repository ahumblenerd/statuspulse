import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.js";
import { getPreviousStatus, persistIncidents, persistStatus } from "../db/queries.js";
import { services } from "../db/schema.js";
import { config } from "../lib/config.js";
import { normalizeFromText } from "../lib/normalize.js";
import type { NormalizedStatusType, StatusChangeEvent } from "../lib/types.js";

/** Verify HMAC-SHA256 signature from the X-StatusPulse-Signature header. */
function verifySignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** Fire an alert through the Restate alerter when status changes via webhook. */
async function fireAlert(vendorId: string, previousStatus: string, newStatus: string) {
  if (previousStatus === newStatus) return;

  const service = db.select().from(services).where(eq(services.vendorId, vendorId)).get();
  const event: StatusChangeEvent = {
    vendorId,
    vendorName: service?.name ?? vendorId,
    previousStatus: previousStatus as NormalizedStatusType,
    currentStatus: newStatus as NormalizedStatusType,
    description: "Status changed via inbound webhook",
    timestamp: new Date().toISOString(),
    region: service?.region ?? "global",
    category: service?.category ?? "other",
  };

  try {
    await fetch(`${config.RESTATE_INGRESS_URL}/alerter/alert/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch {
    console.warn(`[webhook] Failed to fire alert for ${vendorId}`);
  }
}

export const webhookRoutes = new Hono();

webhookRoutes.post("/inbound/:vendorId", async (c) => {
  const vendorId = c.req.param("vendorId");
  const rawBody = await c.req.text();

  const signature = c.req.header("X-StatusPulse-Signature");
  if (!verifySignature(rawBody, signature, config.WEBHOOK_SECRET)) {
    return c.json({ error: "Invalid or missing signature" }, 401);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const previousStatus = getPreviousStatus(vendorId) ?? "operational";

  // Statuspage component_update webhook
  if (body.component_update) {
    const comp = body.component_update;
    const status = normalizeFromText(comp.new_status ?? "operational");
    persistStatus(vendorId, {
      vendorId,
      status,
      description: `Component ${comp.component_name}: ${comp.new_status}`,
      lastCheckedAt: new Date().toISOString(),
    });
    await fireAlert(vendorId, previousStatus, status);
    return c.json({ ok: true, status });
  }

  // Statuspage incident webhook
  if (body.incident) {
    const inc = body.incident;
    const id = `${vendorId}-wh-${inc.id ?? Date.now()}`;
    const status = normalizeFromText(inc.status ?? inc.impact ?? "investigating");
    persistIncidents(vendorId, [
      {
        id,
        vendorId,
        externalId: inc.id,
        title: inc.name ?? "Incoming incident",
        status,
        impact: inc.impact ?? "none",
        shortlink: inc.shortlink,
        createdAt: inc.created_at ?? new Date().toISOString(),
        updatedAt: inc.updated_at ?? new Date().toISOString(),
        resolvedAt: inc.resolved_at,
        updates: [],
      },
    ]);
    return c.json({ ok: true, incidentId: id });
  }

  // Generic: extract status from body text
  const text = JSON.stringify(body);
  const status = normalizeFromText(text);
  persistStatus(vendorId, {
    vendorId,
    status,
    description: text.slice(0, 200),
    lastCheckedAt: new Date().toISOString(),
  });
  await fireAlert(vendorId, previousStatus, status);
  return c.json({ ok: true, status });
});
