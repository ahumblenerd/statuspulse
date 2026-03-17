import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../api/server.js";
import type { AppDatabase } from "../../db/client.js";
import { services, incidents } from "../../db/schema.js";
import { createTestDb } from "../db.js";

describe("GET /api/incidents", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();

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
        {
          id: "i1",
          serviceId: "gh",
          title: "Active outage",
          status: "outage",
          impact: "major",
          region: "us-east",
        },
        {
          id: "i2",
          serviceId: "gh",
          title: "Resolved issue",
          status: "operational",
          impact: "minor",
          resolvedAt: "2026-03-15T07:00:00Z",
          region: "global",
        },
        {
          id: "i3",
          serviceId: "gh",
          title: "Another active",
          status: "degraded",
          impact: "minor",
          region: "eu-west",
        },
      ])
      .run();
  });

  it("returns only active incidents by default", async () => {
    const app = createApp();
    const res = await app.request("/api/incidents");
    const json = await res.json();

    expect(json.incidents).toHaveLength(2);
    expect(json.incidents.every((i: any) => !i.resolvedAt)).toBe(true);
  });

  it("returns all incidents when active=false", async () => {
    const app = createApp();
    const res = await app.request("/api/incidents?active=false");
    const json = await res.json();

    expect(json.incidents).toHaveLength(3);
  });

  it("filters by vendor", async () => {
    const app = createApp();
    const res = await app.request("/api/incidents?vendor=gh");
    const json = await res.json();

    expect(json.incidents.length).toBeGreaterThan(0);
    expect(json.incidents.every((i: any) => i.serviceId === "gh")).toBe(true);
  });

  it("filters by region", async () => {
    const app = createApp();
    const res = await app.request("/api/incidents?region=us-east");
    const json = await res.json();

    expect(json.incidents).toHaveLength(1);
    expect(json.incidents[0].title).toBe("Active outage");
  });

  it("respects limit parameter", async () => {
    const app = createApp();
    const res = await app.request("/api/incidents?limit=1&active=false");
    const json = await res.json();

    expect(json.incidents).toHaveLength(1);
  });
});

describe("GET /api/incidents/:id", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();

    db.insert(services)
      .values({
        id: "gh",
        vendorId: "github",
        name: "GitHub",
        category: "devtools",
      })
      .run();

    db.insert(incidents)
      .values({
        id: "i1",
        serviceId: "gh",
        title: "Test incident",
        status: "outage",
        impact: "major",
      })
      .run();
  });

  it("returns incident details", async () => {
    const app = createApp();
    const res = await app.request("/api/incidents/i1");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.incident.title).toBe("Test incident");
    expect(json.updates).toBeDefined();
  });

  it("returns 404 for unknown incident", async () => {
    const app = createApp();
    const res = await app.request("/api/incidents/nonexistent");
    expect(res.status).toBe(404);
  });
});
