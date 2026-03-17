import { createHmac } from "crypto";
import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../api/server.js";
import type { AppDatabase } from "../../db/client.js";
import { services } from "../../db/schema.js";
import { config } from "../../lib/config.js";
import { createTestDb } from "../db.js";

/** Sign a JSON body with the configured webhook secret. */
function sign(body: string): string {
  return `sha256=${createHmac("sha256", config.WEBHOOK_SECRET).update(body).digest("hex")}`;
}

describe("POST /api/webhooks/inbound/:vendorId", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();

    // Seed a service for the webhook to update
    db.insert(services)
      .values({
        id: "test-vendor",
        vendorId: "test-vendor",
        name: "Test Vendor",
        category: "devtools",
        status: "operational",
        region: "global",
        enabled: true,
      })
      .run();
  });

  it("rejects requests without signature", async () => {
    const app = createApp();
    const body = JSON.stringify({ component_update: { new_status: "degraded" } });

    const res = await app.request("/api/webhooks/inbound/test-vendor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("signature");
  });

  it("rejects requests with invalid signature", async () => {
    const app = createApp();
    const body = JSON.stringify({ component_update: { new_status: "degraded" } });

    const res = await app.request("/api/webhooks/inbound/test-vendor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-StatusPulse-Signature": "sha256=invalid",
      },
      body,
    });

    expect(res.status).toBe(401);
  });

  it("handles Atlassian Statuspage component_update format", async () => {
    const app = createApp();
    const body = JSON.stringify({
      component_update: {
        component_name: "API",
        new_status: "degraded_performance",
      },
    });

    const res = await app.request("/api/webhooks/inbound/test-vendor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-StatusPulse-Signature": sign(body),
      },
      body,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe("degraded");
  });

  it("handles incident webhook format", async () => {
    const app = createApp();
    const body = JSON.stringify({
      incident: {
        id: "inc-123",
        name: "API outage",
        status: "identified",
        impact: "major",
        created_at: "2026-03-15T10:00:00Z",
        updated_at: "2026-03-15T10:05:00Z",
      },
    });

    const res = await app.request("/api/webhooks/inbound/test-vendor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-StatusPulse-Signature": sign(body),
      },
      body,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.incidentId).toContain("test-vendor");
  });

  it("handles generic body with text normalization", async () => {
    const app = createApp();
    const body = JSON.stringify({ message: "All systems operational" });

    const res = await app.request("/api/webhooks/inbound/test-vendor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-StatusPulse-Signature": sign(body),
      },
      body,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe("operational");
  });
});
