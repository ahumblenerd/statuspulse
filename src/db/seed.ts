import { eq } from "drizzle-orm";
import { getEnabledVendors } from "../vendors/registry.js";
import { createBoard, createBoardMonitor } from "./board-queries.js";
import { db } from "./client.js";
import { boards, boardMonitors, services } from "./schema.js";

/**
 * Seed the default board on first boot.
 * 1. Auto-create services from defaultEnabled vendors in catalog
 * 2. Create a Default board
 * 3. Auto-add all services as monitors on the board
 *
 * Result: user opens the app and sees 22 services immediately.
 */
export function seedDefaultBoard(): string | null {
  const existing = db.select().from(boards).limit(1).all();
  if (existing.length > 0) return existing[0].id;

  // Step 1: Auto-populate services from catalog
  const vendors = getEnabledVendors();
  let seeded = 0;
  for (const vendor of vendors) {
    const exists = db.select().from(services).where(eq(services.id, vendor.id)).get();
    if (!exists) {
      db.insert(services)
        .values({
          id: vendor.id,
          vendorId: vendor.id,
          name: vendor.name,
          category: vendor.category,
          statusPageUrl: vendor.statusPageUrl,
          enabled: true,
        })
        .run();
      seeded++;
    }
  }

  // Step 2: Create the default board
  const boardId = createBoard({
    name: "Default",
    slug: "default",
    description: "Your dependency status board — all monitored services at a glance",
    isDefault: true,
  });

  // Step 3: Create monitors for all enabled services
  const enabledServices = db.select().from(services).where(eq(services.enabled, true)).all();
  for (let i = 0; i < enabledServices.length; i++) {
    createBoardMonitor({
      boardId,
      name: enabledServices[i].name,
      monitorType: "provider_service",
      providerServiceId: enabledServices[i].id,
      displayOrder: i,
    });
  }

  console.log(
    `[seed] Seeded ${seeded} services, created default board with ${enabledServices.length} monitors`
  );
  return boardId;
}

/**
 * Ensure the default board has monitors for any new services
 * added after initial seeding (e.g., via API or catalog dialog).
 */
export function syncDefaultBoardMonitors(): void {
  const defaultBoard = db.select().from(boards).where(eq(boards.isDefault, true)).get();
  if (!defaultBoard) return;

  const monitors = db
    .select()
    .from(boardMonitors)
    .where(eq(boardMonitors.boardId, defaultBoard.id))
    .all();

  const monitoredServiceIds = new Set(monitors.map((m) => m.providerServiceId).filter(Boolean));

  const enabledServices = db.select().from(services).where(eq(services.enabled, true)).all();

  let added = 0;
  for (const svc of enabledServices) {
    if (!monitoredServiceIds.has(svc.id)) {
      createBoardMonitor({
        boardId: defaultBoard.id,
        name: svc.name,
        monitorType: "provider_service",
        providerServiceId: svc.id,
        displayOrder: monitors.length + added,
      });
      added++;
    }
  }

  if (added > 0) {
    console.log(`[seed] Added ${added} new monitors to default board`);
  }
}
