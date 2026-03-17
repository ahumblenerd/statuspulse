import { eq } from "drizzle-orm";
import { describe, it, expect, beforeEach } from "vitest";
import type { AppDatabase } from "../../db/client.js";
import {
  services,
  components,
  incidents,
  incidentUpdates,
  alertTargets,
  plugins,
} from "../../db/schema.js";
import { createTestDb } from "../db.js";

describe("database operations", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("services table", () => {
    it("inserts and retrieves a service", () => {
      db.insert(services)
        .values({
          id: "github",
          vendorId: "github",
          name: "GitHub",
          category: "devtools",
          status: "operational",
          description: "All systems operational",
          statusPageUrl: "https://www.githubstatus.com",
          region: "global",
          enabled: true,
        })
        .run();

      const rows = db.select().from(services).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("github");
      expect(rows[0].name).toBe("GitHub");
      expect(rows[0].enabled).toBe(true);
      expect(rows[0].region).toBe("global");
      expect(rows[0].createdAt).toBeTruthy();
    });

    it("uses default values", () => {
      db.insert(services)
        .values({
          id: "test",
          vendorId: "test",
          name: "Test",
          category: "test",
        })
        .run();

      const row = db.select().from(services).where(eq(services.id, "test")).get()!;
      expect(row.status).toBe("operational");
      expect(row.enabled).toBe(true);
      expect(row.region).toBe("global");
    });

    it("updates service status", () => {
      db.insert(services)
        .values({
          id: "gh",
          vendorId: "github",
          name: "GitHub",
          category: "devtools",
        })
        .run();

      db.update(services)
        .set({ status: "degraded", description: "Issues detected" })
        .where(eq(services.id, "gh"))
        .run();

      const row = db.select().from(services).where(eq(services.id, "gh")).get()!;
      expect(row.status).toBe("degraded");
      expect(row.description).toBe("Issues detected");
    });

    it("handles onConflictDoUpdate", () => {
      db.insert(services)
        .values({
          id: "gh",
          vendorId: "github",
          name: "GitHub",
          category: "devtools",
          status: "operational",
        })
        .run();

      db.insert(services)
        .values({
          id: "gh",
          vendorId: "github",
          name: "GitHub Updated",
          category: "devtools",
          status: "degraded",
        })
        .onConflictDoUpdate({
          target: services.id,
          set: { status: "degraded", name: "GitHub Updated" },
        })
        .run();

      const row = db.select().from(services).where(eq(services.id, "gh")).get()!;
      expect(row.status).toBe("degraded");
      expect(row.name).toBe("GitHub Updated");
    });

    it("deletes a service", () => {
      db.insert(services)
        .values({
          id: "gh",
          vendorId: "github",
          name: "GitHub",
          category: "devtools",
        })
        .run();

      db.delete(services).where(eq(services.id, "gh")).run();
      expect(db.select().from(services).all()).toHaveLength(0);
    });
  });

  describe("components table", () => {
    it("inserts components linked to a service", () => {
      db.insert(services)
        .values({
          id: "gh",
          vendorId: "github",
          name: "GitHub",
          category: "devtools",
        })
        .run();

      db.insert(components)
        .values({
          id: "gh-api",
          serviceId: "gh",
          name: "API Requests",
          status: "operational",
          region: "us-east",
        })
        .run();

      const comps = db.select().from(components).where(eq(components.serviceId, "gh")).all();
      expect(comps).toHaveLength(1);
      expect(comps[0].name).toBe("API Requests");
      expect(comps[0].region).toBe("us-east");
    });
  });

  describe("incidents table", () => {
    it("creates incident with updates", () => {
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
          id: "inc-1",
          serviceId: "gh",
          externalId: "abc123",
          title: "Actions outage",
          status: "outage",
          impact: "major",
          region: "us-east",
        })
        .run();

      db.insert(incidentUpdates)
        .values({
          id: "upd-1",
          incidentId: "inc-1",
          status: "investigating",
          body: "We are investigating the issue.",
        })
        .run();

      const inc = db.select().from(incidents).where(eq(incidents.id, "inc-1")).get()!;
      expect(inc.title).toBe("Actions outage");
      expect(inc.region).toBe("us-east");

      const updates = db
        .select()
        .from(incidentUpdates)
        .where(eq(incidentUpdates.incidentId, "inc-1"))
        .all();
      expect(updates).toHaveLength(1);
      expect(updates[0].body).toContain("investigating");
    });

    it("handles conflict on incident upsert", () => {
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
          id: "inc-1",
          serviceId: "gh",
          title: "Outage",
          status: "outage",
          impact: "major",
        })
        .run();

      db.insert(incidents)
        .values({
          id: "inc-1",
          serviceId: "gh",
          title: "Outage",
          status: "outage",
          impact: "major",
          resolvedAt: "2026-03-15T07:00:00Z",
        })
        .onConflictDoUpdate({
          target: incidents.id,
          set: { status: "operational", resolvedAt: "2026-03-15T07:00:00Z" },
        })
        .run();

      const inc = db.select().from(incidents).where(eq(incidents.id, "inc-1")).get()!;
      expect(inc.status).toBe("operational");
      expect(inc.resolvedAt).toBe("2026-03-15T07:00:00Z");
    });
  });

  describe("alert_targets table", () => {
    it("creates and queries alert targets", () => {
      db.insert(alertTargets)
        .values({
          id: "at-1",
          type: "slack",
          name: "Engineering Slack",
          url: "https://hooks.slack.com/services/xxx",
          enabled: true,
          filterRegion: "us-east",
        })
        .run();

      const targets = db.select().from(alertTargets).where(eq(alertTargets.enabled, true)).all();
      expect(targets).toHaveLength(1);
      expect(targets[0].type).toBe("slack");
      expect(targets[0].filterRegion).toBe("us-east");
    });
  });

  describe("plugins table", () => {
    it("stores and retrieves plugin config as JSON string", () => {
      const config = JSON.stringify({
        url: "https://internal.example.com/health",
        statusPath: "status.overall",
        statusMapping: { healthy: "operational", down: "outage" },
      });

      db.insert(plugins)
        .values({
          id: "internal-api",
          name: "Internal API",
          type: "custom-api",
          config,
          enabled: true,
        })
        .run();

      const row = db.select().from(plugins).where(eq(plugins.id, "internal-api")).get()!;
      expect(row.name).toBe("Internal API");
      const parsed = JSON.parse(row.config);
      expect(parsed.url).toBe("https://internal.example.com/health");
      expect(parsed.statusMapping.down).toBe("outage");
    });
  });
});
