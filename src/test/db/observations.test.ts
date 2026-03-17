import { describe, it, expect, beforeEach } from "vitest";
import { createBoard, createBoardMonitor } from "../../db/board-queries.js";
import type { AppDatabase } from "../../db/client.js";
import {
  recordObservation,
  listObservations,
  computeMonitorStatus,
  worstStatus,
} from "../../db/observation-queries.js";
import { services, components } from "../../db/schema.js";
import { createTestDb } from "../db.js";

describe("observation queries", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("recordObservation", () => {
    it("records and lists observations", () => {
      const boardId = createBoard({ name: "T", slug: "t" });
      const monitorId = createBoardMonitor({ boardId, name: "GH" });

      recordObservation({
        boardMonitorId: monitorId,
        source: "official",
        previousStatus: "operational",
        newStatus: "degraded",
      });

      const obs = listObservations(monitorId);
      expect(obs).toHaveLength(1);
      expect(obs[0].previousStatus).toBe("operational");
      expect(obs[0].newStatus).toBe("degraded");
    });
  });

  describe("worstStatus", () => {
    it("returns operational for empty list", () => {
      expect(worstStatus([])).toBe("operational");
    });

    it("returns worst status", () => {
      expect(worstStatus(["operational", "degraded", "maintenance"])).toBe("degraded");
      expect(worstStatus(["operational", "outage"])).toBe("outage");
    });
  });

  describe("computeMonitorStatus", () => {
    it("falls back to service status when no components", () => {
      db.insert(services)
        .values({
          id: "gh",
          vendorId: "github",
          name: "GitHub",
          category: "devtools",
          status: "outage",
        })
        .run();

      // No components — should use service-level status, not default to operational
      expect(
        computeMonitorStatus({
          providerServiceId: "gh",
          selectionMode: "all",
          selectedComponentIds: null,
        })
      ).toBe("outage");
    });

    it("respects statusOverride (simulation)", () => {
      db.insert(services)
        .values({ id: "gh", vendorId: "github", name: "GitHub", category: "devtools" })
        .run();
      db.insert(components)
        .values({ id: "gh-api", serviceId: "gh", name: "API", status: "operational" })
        .run();

      // Override takes priority over computed
      expect(
        computeMonitorStatus({
          providerServiceId: "gh",
          selectionMode: "all",
          selectedComponentIds: null,
          statusOverride: "outage",
        })
      ).toBe("outage");
    });

    it("falls back to service status when include_only filters to empty", () => {
      db.insert(services)
        .values({
          id: "gh",
          vendorId: "github",
          name: "GitHub",
          category: "devtools",
          status: "degraded",
        })
        .run();
      db.insert(components)
        .values({ id: "gh-api", serviceId: "gh", name: "API", status: "operational" })
        .run();

      // include_only with non-existent component = empty filter
      expect(
        computeMonitorStatus({
          providerServiceId: "gh",
          selectionMode: "include_only",
          selectedComponentIds: JSON.stringify(["nonexistent"]),
        })
      ).toBe("degraded");
    });

    it("returns worst component status for all mode", () => {
      db.insert(services)
        .values({ id: "gh", vendorId: "github", name: "GitHub", category: "devtools" })
        .run();
      db.insert(components)
        .values([
          { id: "gh-api", serviceId: "gh", name: "API", status: "operational" },
          { id: "gh-actions", serviceId: "gh", name: "Actions", status: "outage" },
        ])
        .run();

      expect(
        computeMonitorStatus({
          providerServiceId: "gh",
          selectionMode: "all",
          selectedComponentIds: null,
        })
      ).toBe("outage");
    });

    it("filters components in include_only mode", () => {
      db.insert(services)
        .values({ id: "gh", vendorId: "github", name: "GitHub", category: "devtools" })
        .run();
      db.insert(components)
        .values([
          { id: "gh-api", serviceId: "gh", name: "API", status: "operational" },
          { id: "gh-actions", serviceId: "gh", name: "Actions", status: "outage" },
        ])
        .run();

      // Only watching API which is operational
      expect(
        computeMonitorStatus({
          providerServiceId: "gh",
          selectionMode: "include_only",
          selectedComponentIds: JSON.stringify(["gh-api"]),
        })
      ).toBe("operational");
    });

    it("filters components in exclude mode", () => {
      db.insert(services)
        .values({ id: "gh", vendorId: "github", name: "GitHub", category: "devtools" })
        .run();
      db.insert(components)
        .values([
          { id: "gh-api", serviceId: "gh", name: "API", status: "operational" },
          { id: "gh-actions", serviceId: "gh", name: "Actions", status: "outage" },
        ])
        .run();

      // Exclude Actions (the one with outage)
      expect(
        computeMonitorStatus({
          providerServiceId: "gh",
          selectionMode: "exclude",
          selectedComponentIds: JSON.stringify(["gh-actions"]),
        })
      ).toBe("operational");
    });
  });
});
