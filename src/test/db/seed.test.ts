import { describe, it, expect, beforeEach } from "vitest";
import { listBoardMonitors, getDefaultBoard } from "../../db/board-queries.js";
import type { AppDatabase } from "../../db/client.js";
import { services } from "../../db/schema.js";
import { seedDefaultBoard, syncDefaultBoardMonitors } from "../../db/seed.js";
import { getEnabledVendors } from "../../vendors/registry.js";
import { createTestDb } from "../db.js";

const enabledVendorCount = getEnabledVendors().length;

describe("seed", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("seedDefaultBoard", () => {
    it("creates default board on first call", () => {
      const id = seedDefaultBoard();
      expect(id).toBeTruthy();
      const board = getDefaultBoard();
      expect(board?.isDefault).toBe(true);
      expect(board?.slug).toBe("default");
    });

    it("auto-seeds services from catalog and creates monitors", () => {
      const boardId = seedDefaultBoard()!;

      // Should have auto-seeded all defaultEnabled vendors as services
      const allServices = db.select().from(services).all();
      expect(allServices.length).toBe(enabledVendorCount);

      // Each service should have a monitor on the default board
      const monitors = listBoardMonitors(boardId);
      expect(monitors.length).toBe(enabledVendorCount);
    });

    it("includes pre-existing services in board monitors", () => {
      // Add a custom service before seeding
      db.insert(services)
        .values({
          id: "custom",
          vendorId: "custom",
          name: "Custom",
          category: "other",
          enabled: true,
        })
        .run();

      const boardId = seedDefaultBoard()!;
      const monitors = listBoardMonitors(boardId);
      // Catalog vendors + the custom service
      expect(monitors.length).toBe(enabledVendorCount + 1);
    });

    it("is idempotent", () => {
      seedDefaultBoard();
      seedDefaultBoard();
      expect(getDefaultBoard()).toBeTruthy();
    });
  });

  describe("syncDefaultBoardMonitors", () => {
    it("adds monitors for new services added after seeding", () => {
      const boardId = seedDefaultBoard()!;
      const before = listBoardMonitors(boardId).length;

      // Add a new service after initial seed
      db.insert(services)
        .values({
          id: "new-svc",
          vendorId: "new-svc",
          name: "New Service",
          category: "other",
          enabled: true,
        })
        .run();

      syncDefaultBoardMonitors();
      expect(listBoardMonitors(boardId).length).toBe(before + 1);
    });
  });
});
