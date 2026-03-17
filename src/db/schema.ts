import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  vendorId: text("vendor_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("operational"),
  description: text("description").default(""),
  statusPageUrl: text("status_page_url"),
  region: text("region").default("global"), // global, us-east, eu-west, ap-southeast, etc.
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastCheckedAt: text("last_checked_at"),
  lastChangedAt: text("last_changed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const components = sqliteTable("components", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("operational"),
  region: text("region").default("global"),
  description: text("description").default(""),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const incidents = sqliteTable("incidents", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  externalId: text("external_id"),
  title: text("title").notNull(),
  status: text("status").notNull(),
  impact: text("impact").default("none"),
  shortlink: text("shortlink"),
  region: text("region").default("global"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  resolvedAt: text("resolved_at"),
});

export const incidentUpdates = sqliteTable("incident_updates", {
  id: text("id").primaryKey(),
  incidentId: text("incident_id")
    .notNull()
    .references(() => incidents.id),
  status: text("status").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const alertTargets = sqliteTable("alert_targets", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // slack, webhook
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  filterRegion: text("filter_region"), // null = all regions
  filterCategory: text("filter_category"), // null = all categories
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Status change history for uptime tracking and timelines
export const statusChanges = sqliteTable("status_changes", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  previousStatus: text("previous_status").notNull(),
  newStatus: text("new_status").notNull(),
  changedAt: text("changed_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Synthetic probe results for independent health verification
export const probeResults = sqliteTable("probe_results", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  url: text("url").notNull(),
  httpStatus: integer("http_status"),
  latencyMs: integer("latency_ms"),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  error: text("error"),
  checkedAt: text("checked_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Board / Monitor model ──────────────────────────────────────────

/** Boards are curated collections of monitors for different teams/audiences. */
export const boards = sqliteTable("boards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** A user-configured monitor on a board, pointing at a provider service. */
export const boardMonitors = sqliteTable("board_monitors", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  monitorType: text("monitor_type").notNull().default("provider_service"),
  providerServiceId: text("provider_service_id").references(() => services.id),
  name: text("name").notNull(),
  selectionMode: text("selection_mode").notNull().default("all"),
  selectedComponentIds: text("selected_component_ids"), // JSON array
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  showOnStatusPage: integer("show_on_status_page", { mode: "boolean" }).notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  statusOverride: text("status_override"), // set by simulation, takes priority over computed
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Board-scoped alert routing (replaces global alertTargets gradually). */
export const boardAlertTargets = sqliteTable("board_alert_targets", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  filterMonitorIds: text("filter_monitor_ids"), // JSON array, null = all
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Unified status change log for board monitors. */
export const observations = sqliteTable("observations", {
  id: text("id").primaryKey(),
  boardMonitorId: text("board_monitor_id").references(() => boardMonitors.id, {
    onDelete: "cascade",
  }),
  serviceId: text("service_id").references(() => services.id),
  componentId: text("component_id").references(() => components.id),
  source: text("source").notNull().default("official"),
  previousStatus: text("previous_status").notNull(),
  newStatus: text("new_status").notNull(),
  observedAt: text("observed_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Plugin-registered custom status sources
export const plugins = sqliteTable("plugins", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "statuspage", "custom-api", "script"
  config: text("config").notNull(), // JSON: { url, headers, statusPath, mapping, etc. }
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
