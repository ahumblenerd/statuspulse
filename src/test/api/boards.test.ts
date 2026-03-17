import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../api/server.js";
import { createBoard, createBoardMonitor } from "../../db/board-queries.js";
import type { AppDatabase } from "../../db/client.js";
import { services, components } from "../../db/schema.js";
import { createTestDb } from "../db.js";

describe("boards API", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("GET /api/boards", () => {
    it("returns empty list initially", async () => {
      const app = createApp();
      const res = await app.request("/api/boards");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.boards).toHaveLength(0);
    });

    it("returns created boards", async () => {
      createBoard({ name: "Eng", slug: "eng" });
      createBoard({ name: "Ops", slug: "ops" });
      const app = createApp();
      const res = await app.request("/api/boards");
      const json = await res.json();
      expect(json.boards).toHaveLength(2);
    });
  });

  describe("POST /api/boards", () => {
    it("creates a board", async () => {
      const app = createApp();
      const res = await app.request("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Engineering", slug: "eng" }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.id).toBeTruthy();
    });

    it("rejects invalid slug", async () => {
      const app = createApp();
      const res = await app.request("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", slug: "Bad Slug!" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/boards/:id", () => {
    it("returns board with monitors and aggregate status", async () => {
      db.insert(services)
        .values({
          id: "github",
          vendorId: "github",
          name: "GitHub",
          category: "devtools",
          status: "degraded",
        })
        .run();
      db.insert(components)
        .values({ id: "gh-api", serviceId: "github", name: "API", status: "degraded" })
        .run();

      const boardId = createBoard({ name: "Eng", slug: "eng" });
      createBoardMonitor({ boardId, name: "GitHub", providerServiceId: "github" });

      const app = createApp();
      const res = await app.request(`/api/boards/${boardId}`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.board.name).toBe("Eng");
      expect(json.monitors).toHaveLength(1);
      expect(json.monitors[0].computedStatus).toBe("degraded");
      expect(json.aggregateStatus).toBe("degraded");
    });

    it("returns 404 for unknown board", async () => {
      const app = createApp();
      const res = await app.request("/api/boards/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/boards/:id", () => {
    it("prevents deleting default board", async () => {
      const boardId = createBoard({ name: "Default", slug: "default", isDefault: true });
      const app = createApp();
      const res = await app.request(`/api/boards/${boardId}`, { method: "DELETE" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/boards/:id/duplicate", () => {
    it("duplicates board with monitors", async () => {
      const boardId = createBoard({ name: "Original", slug: "original" });
      createBoardMonitor({ boardId, name: "GitHub" });
      createBoardMonitor({ boardId, name: "Stripe" });

      const app = createApp();
      const res = await app.request(`/api/boards/${boardId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Copy", slug: "copy" }),
      });
      expect(res.status).toBe(201);

      const json = await res.json();
      const copyRes = await app.request(`/api/boards/${json.id}`);
      const copyJson = await copyRes.json();
      expect(copyJson.monitors).toHaveLength(2);
    });
  });
});
