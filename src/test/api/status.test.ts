import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../api/server.js";
import type { AppDatabase } from "../../db/client.js";
import { services, incidents } from "../../db/schema.js";
import { createTestDb } from "../db.js";

describe("GET /api/status", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  it("returns operational when all services are green", async () => {
    db.insert(services)
      .values([
        {
          id: "a",
          vendorId: "a",
          name: "A",
          category: "cloud",
          status: "operational",
          enabled: true,
        },
        {
          id: "b",
          vendorId: "b",
          name: "B",
          category: "devtools",
          status: "operational",
          enabled: true,
        },
      ])
      .run();

    const app = createApp();
    const res = await app.request("/api/status");
    const json = await res.json();

    expect(json.status).toBe("operational");
    expect(json.totalServices).toBe(2);
    expect(json.activeIncidents).toBe(0);
  });

  it("returns worst status across services", async () => {
    db.insert(services)
      .values([
        {
          id: "a",
          vendorId: "a",
          name: "A",
          category: "cloud",
          status: "operational",
          enabled: true,
        },
        {
          id: "b",
          vendorId: "b",
          name: "B",
          category: "devtools",
          status: "outage",
          enabled: true,
        },
      ])
      .run();

    const app = createApp();
    const res = await app.request("/api/status");
    const json = await res.json();

    expect(json.status).toBe("outage");
  });

  it("groups by category", async () => {
    db.insert(services)
      .values([
        {
          id: "a",
          vendorId: "a",
          name: "A",
          category: "cloud",
          status: "operational",
          enabled: true,
        },
        { id: "b", vendorId: "b", name: "B", category: "cloud", status: "degraded", enabled: true },
        {
          id: "c",
          vendorId: "c",
          name: "C",
          category: "devtools",
          status: "operational",
          enabled: true,
        },
      ])
      .run();

    const app = createApp();
    const res = await app.request("/api/status");
    const json = await res.json();

    expect(json.byCategory.cloud.status).toBe("degraded");
    expect(json.byCategory.cloud.count).toBe(2);
    expect(json.byCategory.devtools.status).toBe("operational");
  });

  it("groups by region", async () => {
    db.insert(services)
      .values([
        {
          id: "a",
          vendorId: "a",
          name: "A",
          category: "cloud",
          status: "operational",
          region: "us-east",
          enabled: true,
        },
        {
          id: "b",
          vendorId: "b",
          name: "B",
          category: "cloud",
          status: "outage",
          region: "us-east",
          enabled: true,
        },
        {
          id: "c",
          vendorId: "c",
          name: "C",
          category: "cloud",
          status: "operational",
          region: "eu-west",
          enabled: true,
        },
      ])
      .run();

    const app = createApp();
    const res = await app.request("/api/status");
    const json = await res.json();

    expect(json.byRegion["us-east"].status).toBe("outage");
    expect(json.byRegion["eu-west"].status).toBe("operational");
  });

  it("filters by region query param", async () => {
    db.insert(services)
      .values([
        {
          id: "a",
          vendorId: "a",
          name: "A",
          category: "cloud",
          status: "operational",
          region: "us-east",
          enabled: true,
        },
        {
          id: "b",
          vendorId: "b",
          name: "B",
          category: "cloud",
          status: "outage",
          region: "eu-west",
          enabled: true,
        },
      ])
      .run();

    const app = createApp();
    const res = await app.request("/api/status?region=us-east");
    const json = await res.json();

    expect(json.status).toBe("operational");
    expect(json.totalServices).toBe(1);
  });

  it("counts active incidents", async () => {
    db.insert(services)
      .values({
        id: "gh",
        vendorId: "github",
        name: "GitHub",
        category: "devtools",
        status: "outage",
        enabled: true,
      })
      .run();

    db.insert(incidents)
      .values([
        { id: "i1", serviceId: "gh", title: "Outage 1", status: "outage", impact: "major" },
        {
          id: "i2",
          serviceId: "gh",
          title: "Outage 2",
          status: "outage",
          impact: "critical",
          resolvedAt: "2026-03-15T07:00:00Z",
        },
      ])
      .run();

    const app = createApp();
    const res = await app.request("/api/status");
    const json = await res.json();

    expect(json.activeIncidents).toBe(1); // only unresolved
  });
});
