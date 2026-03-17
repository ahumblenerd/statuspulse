import { describe, it, expect, beforeEach } from "vitest";
import {
  createBoard,
  listBoards,
  getBoardById,
  getBoardBySlug,
  updateBoard,
  deleteBoard,
  getDefaultBoard,
  createBoardMonitor,
  listBoardMonitors,
  getBoardMonitor,
  updateBoardMonitor,
  deleteBoardMonitor,
  createBoardAlertTarget,
  listBoardAlertTargets,
  deleteBoardAlertTarget,
} from "../../db/board-queries.js";
import type { AppDatabase } from "../../db/client.js";
import { services } from "../../db/schema.js";
import { createTestDb } from "../db.js";

describe("board queries", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("boards CRUD", () => {
    it("creates and retrieves a board", () => {
      const id = createBoard({ name: "Eng", slug: "eng", description: "Engineering" });
      const board = getBoardById(id);
      expect(board).toBeTruthy();
      expect(board!.name).toBe("Eng");
      expect(board!.slug).toBe("eng");
    });

    it("lists all boards", () => {
      createBoard({ name: "A", slug: "a" });
      createBoard({ name: "B", slug: "b" });
      expect(listBoards()).toHaveLength(2);
    });

    it("finds board by slug", () => {
      createBoard({ name: "Ops", slug: "ops-team" });
      const board = getBoardBySlug("ops-team");
      expect(board?.name).toBe("Ops");
    });

    it("updates board", () => {
      const id = createBoard({ name: "Old", slug: "old" });
      updateBoard(id, { name: "New" });
      expect(getBoardById(id)!.name).toBe("New");
    });

    it("deletes non-default board", () => {
      const id = createBoard({ name: "Tmp", slug: "tmp" });
      expect(deleteBoard(id)).toBe(true);
      expect(getBoardById(id)).toBeUndefined();
    });

    it("prevents deleting default board", () => {
      const id = createBoard({ name: "Default", slug: "default", isDefault: true });
      expect(deleteBoard(id)).toBe(false);
      expect(getBoardById(id)).toBeTruthy();
    });

    it("returns default board", () => {
      createBoard({ name: "Default", slug: "default", isDefault: true });
      createBoard({ name: "Other", slug: "other" });
      const def = getDefaultBoard();
      expect(def?.name).toBe("Default");
    });
  });

  describe("board monitors CRUD", () => {
    let boardId: string;

    beforeEach(() => {
      boardId = createBoard({ name: "Test", slug: "test" });
    });

    it("creates and lists monitors", () => {
      createBoardMonitor({ boardId, name: "GitHub" });
      createBoardMonitor({ boardId, name: "Stripe" });
      expect(listBoardMonitors(boardId)).toHaveLength(2);
    });

    it("gets a single monitor", () => {
      db.insert(services)
        .values({ id: "github", vendorId: "github", name: "GitHub", category: "devtools" })
        .run();
      const id = createBoardMonitor({ boardId, name: "GitHub", providerServiceId: "github" });
      const m = getBoardMonitor(id);
      expect(m?.name).toBe("GitHub");
      expect(m?.providerServiceId).toBe("github");
    });

    it("updates monitor", () => {
      const id = createBoardMonitor({ boardId, name: "Old" });
      updateBoardMonitor(id, { name: "New", enabled: false });
      const m = getBoardMonitor(id);
      expect(m?.name).toBe("New");
      expect(m?.enabled).toBe(false);
    });

    it("stores selectedComponentIds as JSON", () => {
      const id = createBoardMonitor({
        boardId,
        name: "Filtered",
        selectedComponentIds: ["comp-1", "comp-2"],
      });
      const m = getBoardMonitor(id);
      expect(JSON.parse(m!.selectedComponentIds!)).toEqual(["comp-1", "comp-2"]);
    });

    it("deletes monitor", () => {
      const id = createBoardMonitor({ boardId, name: "Tmp" });
      deleteBoardMonitor(id);
      expect(getBoardMonitor(id)).toBeUndefined();
    });
  });

  describe("board alert targets", () => {
    let boardId: string;

    beforeEach(() => {
      boardId = createBoard({ name: "Test", slug: "test" });
    });

    it("creates and lists targets", () => {
      createBoardAlertTarget({
        boardId,
        type: "slack",
        name: "Eng Slack",
        url: "https://hooks.slack.com/xxx",
      });
      expect(listBoardAlertTargets(boardId)).toHaveLength(1);
    });

    it("deletes target", () => {
      const id = createBoardAlertTarget({
        boardId,
        type: "webhook",
        name: "Webhook",
        url: "https://example.com/hook",
      });
      deleteBoardAlertTarget(id);
      expect(listBoardAlertTargets(boardId)).toHaveLength(0);
    });
  });
});
