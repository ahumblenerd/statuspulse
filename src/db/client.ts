import { mkdirSync } from "fs";
import { dirname } from "path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

const DDL = `
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    vendor_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'operational',
    description TEXT DEFAULT '',
    status_page_url TEXT,
    region TEXT DEFAULT 'global',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_checked_at TEXT,
    last_changed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS components (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'operational',
    region TEXT DEFAULT 'global',
    description TEXT DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id),
    external_id TEXT,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    impact TEXT DEFAULT 'none',
    shortlink TEXT,
    region TEXT DEFAULT 'global',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS incident_updates (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES incidents(id),
    status TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS alert_targets (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    filter_region TEXT,
    filter_category TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS status_changes (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id),
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    changed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS probe_results (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id),
    url TEXT NOT NULL,
    http_status INTEGER,
    latency_ms INTEGER,
    ok INTEGER NOT NULL,
    error TEXT,
    checked_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS board_monitors (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    monitor_type TEXT NOT NULL DEFAULT 'provider_service',
    provider_service_id TEXT REFERENCES services(id),
    name TEXT NOT NULL,
    selection_mode TEXT NOT NULL DEFAULT 'all',
    selected_component_ids TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    show_on_status_page INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    status_override TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS board_alert_targets (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    filter_monitor_ids TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    board_monitor_id TEXT REFERENCES board_monitors(id) ON DELETE CASCADE,
    service_id TEXT REFERENCES services(id),
    component_id TEXT REFERENCES components(id),
    source TEXT NOT NULL DEFAULT 'official',
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    observed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

/**
 * Create a database instance. Pass ":memory:" for tests.
 */
export function createDatabase(path: string): AppDatabase {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  return drizzle(sqlite, { schema });
}

// Default singleton — initialized on first access
let _db: AppDatabase | null = null;
let _initialized = false;

export function initDb(path: string): AppDatabase {
  _db = createDatabase(path);
  _initialized = true;
  return _db;
}

export function getDb(): AppDatabase {
  if (!_db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return _db;
}

/**
 * Set the global db instance (used by tests and mock mode).
 */
export function setDb(database: AppDatabase): void {
  _db = database;
}

// For backward compat: `import { db } from "./client.js"`
// Proxy that delegates to the singleton
export const db: AppDatabase = new Proxy({} as AppDatabase, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});
