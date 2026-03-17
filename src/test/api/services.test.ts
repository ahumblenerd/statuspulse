import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../api/server.js";
import type { AppDatabase } from "../../db/client.js";
import { services } from "../../db/schema.js";
import { createTestDb } from "../db.js";

describe("GET /api/services", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();

    // Seed test data
    db.insert(services)
      .values([
        {
          id: "github",
          vendorId: "github",
          name: "GitHub",
          category: "devtools",
          status: "operational",
          region: "global",
          enabled: true,
        },
        {
          id: "stripe",
          vendorId: "stripe",
          name: "Stripe",
          category: "payments",
          status: "degraded",
          region: "us-east",
          enabled: true,
        },
        {
          id: "disabled",
          vendorId: "disabled",
          name: "Disabled Svc",
          category: "other",
          status: "operational",
          region: "global",
          enabled: false,
        },
      ])
      .run();
  });

  it("returns all enabled services", async () => {
    const app = createApp();
    const res = await app.request("/api/services");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.services).toHaveLength(2); // excludes disabled
  });

  it("returns disabled services when enabled=false", async () => {
    const app = createApp();
    const res = await app.request("/api/services?enabled=false");
    const json = await res.json();
    expect(json.services).toHaveLength(3);
  });

  it("filters by region", async () => {
    const app = createApp();
    const res = await app.request("/api/services?region=us-east");
    const json = await res.json();
    expect(json.services).toHaveLength(1);
    expect(json.services[0].name).toBe("Stripe");
  });

  it("filters by category", async () => {
    const app = createApp();
    const res = await app.request("/api/services?category=devtools");
    const json = await res.json();
    expect(json.services).toHaveLength(1);
    expect(json.services[0].name).toBe("GitHub");
  });
});

describe("GET /api/services/:id", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();
    db.insert(services)
      .values({
        id: "github",
        vendorId: "github",
        name: "GitHub",
        category: "devtools",
        status: "operational",
      })
      .run();
  });

  it("returns service details", async () => {
    const app = createApp();
    const res = await app.request("/api/services/github");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.service.name).toBe("GitHub");
    expect(json.components).toBeDefined();
  });

  it("returns 404 for unknown service", async () => {
    const app = createApp();
    const res = await app.request("/api/services/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/services", () => {
  beforeEach(() => {
    createTestDb();
  });

  it("creates a service from catalog vendor", async () => {
    const app = createApp();
    const res = await app.request("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId: "github" }),
    });
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("rejects unknown vendor", async () => {
    const app = createApp();
    const res = await app.request("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId: "fakefake" }),
    });
    expect(res.status).toBe(400);
  });
});
