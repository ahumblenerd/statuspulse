import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { boards, boardMonitors, boardAlertTargets } from "./schema.js";

// ── Boards ────────────────────────────────────────────────────────

/** Create a board and return its id. */
export function createBoard(opts: {
  name: string;
  slug: string;
  description?: string;
  isDefault?: boolean;
}): string {
  const id = randomUUID();
  db.insert(boards)
    .values({
      id,
      name: opts.name,
      slug: opts.slug,
      description: opts.description ?? null,
      isDefault: opts.isDefault ?? false,
    })
    .run();
  return id;
}

/** List all boards. */
export function listBoards() {
  return db.select().from(boards).all();
}

/** Get board by id. */
export function getBoardById(id: string) {
  return db.select().from(boards).where(eq(boards.id, id)).get();
}

/** Get board by slug. */
export function getBoardBySlug(slug: string) {
  return db.select().from(boards).where(eq(boards.slug, slug)).get();
}

/** Update a board. */
export function updateBoard(
  id: string,
  patch: Partial<{ name: string; slug: string; description: string }>
) {
  db.update(boards).set(patch).where(eq(boards.id, id)).run();
}

/** Delete a board (prevents deleting default). Returns true if deleted. */
export function deleteBoard(id: string): boolean {
  const board = getBoardById(id);
  if (!board || board.isDefault) return false;
  db.delete(boards).where(eq(boards.id, id)).run();
  return true;
}

/** Get the default board, or null. */
export function getDefaultBoard() {
  return db.select().from(boards).where(eq(boards.isDefault, true)).get() ?? null;
}

// ── Board Monitors ────────────────────────────────────────────────

/** Add a monitor to a board. */
export function createBoardMonitor(opts: {
  boardId: string;
  name: string;
  monitorType?: string;
  providerServiceId?: string;
  selectionMode?: string;
  selectedComponentIds?: string[];
  displayOrder?: number;
}): string {
  const id = randomUUID();
  db.insert(boardMonitors)
    .values({
      id,
      boardId: opts.boardId,
      name: opts.name,
      monitorType: opts.monitorType ?? "provider_service",
      providerServiceId: opts.providerServiceId ?? null,
      selectionMode: opts.selectionMode ?? "all",
      selectedComponentIds: opts.selectedComponentIds
        ? JSON.stringify(opts.selectedComponentIds)
        : null,
      displayOrder: opts.displayOrder ?? 0,
    })
    .run();
  return id;
}

/** List monitors for a board. */
export function listBoardMonitors(boardId: string) {
  return db.select().from(boardMonitors).where(eq(boardMonitors.boardId, boardId)).all();
}

/** Get a single monitor. */
export function getBoardMonitor(id: string) {
  return db.select().from(boardMonitors).where(eq(boardMonitors.id, id)).get();
}

/** Update a monitor. */
export function updateBoardMonitor(
  id: string,
  patch: Partial<{
    name: string;
    selectionMode: string;
    selectedComponentIds: string[] | null;
    enabled: boolean;
    showOnStatusPage: boolean;
    displayOrder: number;
  }>
) {
  const set: Record<string, unknown> = { ...patch };
  if (patch.selectedComponentIds !== undefined) {
    set.selectedComponentIds = patch.selectedComponentIds
      ? JSON.stringify(patch.selectedComponentIds)
      : null;
  }
  db.update(boardMonitors).set(set).where(eq(boardMonitors.id, id)).run();
}

/** Delete a monitor. */
export function deleteBoardMonitor(id: string) {
  db.delete(boardMonitors).where(eq(boardMonitors.id, id)).run();
}

// ── Board Alert Targets ───────────────────────────────────────────

/** Create an alert target on a board. */
export function createBoardAlertTarget(opts: {
  boardId: string;
  type: string;
  name: string;
  url: string;
  secret?: string;
  filterMonitorIds?: string[];
}): string {
  const id = randomUUID();
  db.insert(boardAlertTargets)
    .values({
      id,
      boardId: opts.boardId,
      type: opts.type,
      name: opts.name,
      url: opts.url,
      secret: opts.secret ?? null,
      filterMonitorIds: opts.filterMonitorIds ? JSON.stringify(opts.filterMonitorIds) : null,
    })
    .run();
  return id;
}

/** List alert targets for a board. */
export function listBoardAlertTargets(boardId: string) {
  return db.select().from(boardAlertTargets).where(eq(boardAlertTargets.boardId, boardId)).all();
}

/** Delete a board alert target. */
export function deleteBoardAlertTarget(id: string) {
  db.delete(boardAlertTargets).where(eq(boardAlertTargets.id, id)).run();
}

// ── Monitor Status Overrides (Simulation) ─────────────────────────

/** Set a simulation override on a monitor. */
export function setMonitorOverride(monitorId: string, status: string) {
  db.update(boardMonitors)
    .set({ statusOverride: status })
    .where(eq(boardMonitors.id, monitorId))
    .run();
}

/** Clear a monitor's simulation override (return to computed status). */
export function clearMonitorOverride(monitorId: string) {
  db.update(boardMonitors)
    .set({ statusOverride: null })
    .where(eq(boardMonitors.id, monitorId))
    .run();
}

/** Clear all overrides on a board (reset simulation). */
export function clearBoardOverrides(boardId: string) {
  db.update(boardMonitors)
    .set({ statusOverride: null })
    .where(eq(boardMonitors.boardId, boardId))
    .run();
}
