import { describe, it, expect, beforeEach } from "vitest";
import { createBoard, createBoardMonitor } from "../../db/board-queries.js";
import type { AppDatabase } from "../../db/client.js";
import { listObservations } from "../../db/observation-queries.js";
import { services, components } from "../../db/schema.js";
import { projectServiceUpdate, resetProjectorCache } from "../../restate/projector.js";
import { createTestDb } from "../db.js";

describe("projector", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();
    resetProjectorCache();
  });

  it("detects status change and writes observation", () => {
    db.insert(services)
      .values({ id: "gh", vendorId: "github", name: "GitHub", category: "devtools" })
      .run();
    db.insert(components)
      .values([
        { id: "gh-api", serviceId: "gh", name: "API", status: "outage" },
        { id: "gh-actions", serviceId: "gh", name: "Actions", status: "operational" },
      ])
      .run();

    const boardId = createBoard({ name: "Eng", slug: "eng" });
    const monId = createBoardMonitor({ boardId, name: "GitHub", providerServiceId: "gh" });

    const changes = projectServiceUpdate("gh", "GitHub");

    // Monitor should transition from operational (default) to outage
    expect(changes).toHaveLength(1);
    expect(changes[0].event.previousStatus).toBe("operational");
    expect(changes[0].event.currentStatus).toBe("outage");
    expect(changes[0].boardId).toBe(boardId);

    // Observation should be recorded
    const obs = listObservations(monId);
    expect(obs).toHaveLength(1);
    expect(obs[0].newStatus).toBe("outage");
  });

  it("does not emit event when status unchanged", () => {
    db.insert(services)
      .values({ id: "gh", vendorId: "github", name: "GitHub", category: "devtools" })
      .run();
    db.insert(components)
      .values({ id: "gh-api", serviceId: "gh", name: "API", status: "operational" })
      .run();

    const boardId = createBoard({ name: "Eng", slug: "eng" });
    createBoardMonitor({ boardId, name: "GitHub", providerServiceId: "gh" });

    // operational → operational = no change
    const events = projectServiceUpdate("gh", "GitHub");
    expect(events).toHaveLength(0);
  });

  it("respects component filtering (include_only)", () => {
    db.insert(services)
      .values({ id: "gh", vendorId: "github", name: "GitHub", category: "devtools" })
      .run();
    db.insert(components)
      .values([
        { id: "gh-api", serviceId: "gh", name: "API", status: "operational" },
        { id: "gh-actions", serviceId: "gh", name: "Actions", status: "outage" },
      ])
      .run();

    const boardId = createBoard({ name: "Eng", slug: "eng" });
    createBoardMonitor({
      boardId,
      name: "GitHub (API only)",
      providerServiceId: "gh",
      selectionMode: "include_only",
      selectedComponentIds: ["gh-api"],
    });

    // API is operational, so no change from default
    const events = projectServiceUpdate("gh", "GitHub");
    expect(events).toHaveLength(0);
  });
});
