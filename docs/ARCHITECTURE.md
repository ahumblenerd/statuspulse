# StatusPulse Architecture

## System Overview

StatusPulse is a self-hosted status aggregator. It polls SaaS vendor status pages, normalizes the data into a canonical model, then **projects** it through user-configured boards and monitors. Results are exposed via REST API, MCP protocol, and a React dashboard.

```
                    ┌─────────────────────────────────────────────────────┐
                    │                    External World                   │
                    │  Statuspage APIs  │  RSS Feeds  │  Custom Endpoints │
                    └────────┬──────────┴──────┬──────┴────────┬──────────┘
                             │                 │               │
                    ┌────────▼─────────────────▼───────────────▼──────────┐
                    │              INGESTION LAYER                        │
                    │  statuspage-api │ rss │ scraper │ plugin-runner │   │
                    │  probe │ webhook-receiver                          │
                    └────────┬────────────────────────────────────────────┘
                             │ ServiceStatus, ComponentStatus[], Incident[]
                    ┌────────▼────────────────────────────────────────────┐
                    │              NORMALIZATION + PERSISTENCE            │
                    │  normalize.ts → 4 statuses → db/queries.ts         │
                    │  Writes canonical: services, components, incidents  │
                    └────────┬────────────────────────────────────────────┘
                             │ on change
                    ┌────────▼────────────────────────────────────────────┐
                    │              PROJECTOR                              │
                    │  projector.ts: for each boardMonitor referencing    │
                    │  the updated service → computeMonitorStatus()      │
                    │  → detect change → write observation → emit event  │
                    └────────┬────────────────────────────────────────────┘
                             │ StatusChangeEvent[]
              ┌──────────────▼───────┐                    ┌───────────────┐
              │   RESTATE RUNTIME    │                    │  PERSISTENCE  │
              │  ┌────────────────┐  │    writes          │    LAYER      │
              │  │ Poller (VObj)  │──┼───────────────────▶│  SQLite/WAL   │
              │  │ per-vendor key │  │                    │  Drizzle ORM  │
              │  └───────┬────────┘  │                    │               │
              │          │ on change │                    │  Tables:      │
              │  ┌───────▼────────┐  │                    │  - services   │
              │  │ Alerter (Svc)  │  │                    │  - components │
              │  │ board-scoped   │  │                    │  - incidents  │
              │  │ fan-out alerts │  │                    │  - boards     │
              │  └───────┬────────┘  │                    │  - board_mons │
              │          │           │                    │  - board_atgts│
              │  ┌───────▼────────┐  │                    │  - observatns │
              │  │ Scheduler (WF) │  │                    │  - plugins    │
              │  │ bootstrap all  │  │                    └───────┬───────┘
              │  └────────────────┘  │                            │ reads
              └──────────────────────┘                            │
                                                       ┌──────────▼───────┐
                    ┌─────────────────────────────────▶│   API LAYER      │
                    │                                  │  Hono HTTP :3000 │
                    │  ┌────────────────────────────┐  │                  │
                    │  │       MCP SERVER            │  │  /api/boards    │
                    │  │  Streamable HTTP :3001      │  │  /api/boards/:id│
                    │  │  + stdio transport          │──│  /api/mock/*    │
                    │  │                             │  │  /api/services  │
                    │  │  7 tools, 2 resources       │  │  /api/status    │
                    │  └────────────────────────────┘  │  /api/incidents  │
                    │                                  └──────────┬───────┘
                    │                                             │
                    │                                  ┌──────────▼───────┐
                    │                                  │   PRESENTATION   │
                    │                                  │  Next.js + shadcn│
                    │                                  │  :3000 (prod)    │
                    │                                  └──────────────────┘
                    │
              ┌─────┴──────────────┐    ┌──────────────────────────┐
              │   ALERT TARGETS    │    │   MOCK ENGINE            │
              │  Slack webhooks    │    │  Scenarios, overrides,   │
              │  MS Teams          │    │  history seeding         │
              │  HTTP + HMAC-256   │    │  (product feature)       │
              └────────────────────┘    └──────────────────────────┘
```

---

## Data Model: Boards, Monitors, and Observations

The original model (services, components, incidents) stores **canonical provider data** — the ground truth polled from upstream. The board/monitor layer lets users curate what they care about.

```
boards 1──* boardMonitors *──1 services
  │                │
  │                └──* observations (status change log)
  │
  └──* boardAlertTargets (board-scoped alerting)
```

**boards** — Named collections with a unique slug. One board is the default. Teams create boards for different audiences (engineering, customers, executives).

**boardMonitors** — A user-configured lens onto a provider service. Key fields:
- `selectionMode`: `all` | `include_only` | `exclude` — which components matter
- `selectedComponentIds`: JSON array filtering to specific components
- `showOnStatusPage`: controls public visibility

**observations** — Unified status change log. Every time a monitor's computed status changes, an observation is written. Source is `"official"` for real polls, `"mock"` for scenario-driven changes.

**boardAlertTargets** — Alert routing scoped to a board, with optional `filterMonitorIds` to narrow alerts to specific monitors.

---

## Module Dependency Graph

```
src/lib/types.ts          ← (no deps, pure type definitions)
src/lib/config.ts         ← zod, dotenv (reads process.env)
src/lib/normalize.ts      ← types.ts (pure functions)

src/vendors/catalog.json  ← (static data)
src/vendors/registry.ts   ← catalog.json, types.ts (reads file, memoized)

src/db/schema.ts          ← drizzle-orm (pure schema definitions)
src/db/client.ts          ← schema.ts, config.ts, better-sqlite3
src/db/queries.ts         ← client.ts, schema.ts (service/component persistence)
src/db/board-queries.ts   ← client.ts, schema.ts (board/monitor CRUD)
src/db/observation-queries.ts ← client.ts, schema.ts (observations + status computation)
src/db/seed.ts            ← board-queries.ts, client.ts (default board setup)

src/ingestion/*           ← normalize.ts, types.ts (uses global fetch)
src/alerts/*              ← types.ts (uses global fetch)

src/restate/poller.ts     ← ingestion/*, db/*, projector.ts, vendors/registry
src/restate/projector.ts  ← db/board-queries, db/observation-queries, db/schema
src/restate/alerter.ts    ← db/*, alerts/*, projector.ts
src/restate/scheduler.ts  ← vendors/registry, db/*

src/api/routes/boards.ts         ← db/board-queries, db/observation-queries
src/api/routes/board-monitors.ts ← db/board-queries
src/api/routes/board-alerts.ts   ← db/board-queries
src/api/routes/board-status.ts   ← db/board-queries, db/observation-queries
src/api/routes/mock.ts           ← mock/board-scenarios, mock/seed-history, mock/scenarios

src/mock/board-scenarios.ts ← db/board-queries, db/observation-queries, mock/scenarios
src/mock/seed-history.ts    ← db/board-queries, db/schema, db/client

src/vision/detect.ts       ← @anthropic-ai/sdk, vendors/registry, config
src/mcp/server.ts          ← db/*, vendors/registry, normalize, vision/detect
```

---

## Projector Pipeline

The projector is the key architectural addition. It sits between canonical data writes and alerting.

```
Poller writes canonical data (services, components)
  │
  ▼
projector.projectServiceUpdate(serviceId, vendorName)
  │
  ├─ find all boardMonitors referencing this serviceId
  ├─ for each monitor:
  │   ├─ computeMonitorStatus(monitor)
  │   │   └─ reads components, applies selectionMode filter, returns worstStatus
  │   ├─ compare against in-memory cache of last-known status
  │   └─ if changed:
  │       ├─ recordObservation({ boardMonitorId, serviceId, source: "official", prev, new })
  │       └─ emit StatusChangeEvent
  │
  ▼
alerter receives events → getBoardAlertTargetsForMonitor(monitorId)
  └─ fan-out to board-scoped Slack/webhook/Teams targets
```

`computeMonitorStatus` is the core function. It loads components for the monitor's provider service, applies the selection filter (`all`, `include_only`, `exclude`), and returns `worstStatus()` across filtered components.

---

## API Routes

### Board Management (authenticated)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/boards` | List all boards |
| POST | `/api/boards` | Create board (name, slug, description) |
| GET | `/api/boards/:id` | Board detail + monitors with computed status |
| PATCH | `/api/boards/:id` | Update board |
| DELETE | `/api/boards/:id` | Delete board (not default) |
| POST | `/api/boards/:id/duplicate` | Clone board with all monitors |

### Monitor Management (authenticated)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/boards/:id/monitors` | List monitors for a board |
| POST | `/api/boards/:id/monitors` | Add monitor to board |
| PATCH | `/api/boards/:id/monitors/:mid` | Update monitor |
| DELETE | `/api/boards/:id/monitors/:mid` | Remove monitor |

### Board Alerts (authenticated)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/boards/:id/alerts` | List alert targets for a board |
| POST | `/api/boards/:id/alerts` | Create board alert target |

### Public Status (no auth)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/boards/:slug/public` | Public status page data for a board |

### Mock Engine (authenticated, MOCK_MODE only)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/mock/scenarios` | List available scenarios |
| POST | `/api/mock/boards/:boardId/scenarios/:name` | Apply scenario to a board |
| POST | `/api/mock/monitors/:monitorId/status` | Override single monitor status |
| POST | `/api/mock/monitors/:monitorId/components/:cid/status` | Override component status |
| POST | `/api/mock/monitors/:monitorId/reset` | Reset monitor to operational |
| POST | `/api/mock/seed-history` | Seed historical observations for a board |

### Legacy / Global (authenticated)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/services` | List all canonical services |
| GET | `/api/incidents` | List incidents |
| GET | `/api/status` | Global aggregate status |
| POST | `/api/plugins` | Register custom plugin |
| POST | `/api/upload/detect` | Vision-based vendor detection |

---

## Mock as a Product Feature

Mock mode is not dev tooling. It is a **product feature** that creates the first "aha moment" for new users and simplifies integration testing.

### Why it matters
- New users get a populated board in seconds without configuring real vendor credentials
- Frontend developers build against realistic data without a polling backend
- QA teams test alert routing by applying failure scenarios on demand
- CI pipelines seed known states for integration tests

### How it works

**Scenarios** are named state presets (e.g., `all-operational`, `partial-outage`, `major-incident`). Applying a scenario to a board:
1. Writes state into canonical `services` and `components` tables
2. Computes each board monitor's new status via `computeMonitorStatus()`
3. Records `observations` with `source: "mock"` for any status changes
4. Returns the list of changes so the caller sees what happened

**Per-monitor overrides** let users set a single monitor's underlying service or component to any status, useful for testing specific alert routing paths.

**History seeding** generates 30 days (configurable) of plausible incident history: 2-5 incidents per monitor per month, each lasting 15 min to 4 hrs, with 60% degraded / 25% outage / 15% maintenance distribution. This populates uptime charts and timelines.

All mock operations go through the same `observations` table and projector logic as real data. The only difference is the `source` field.

---

## I/O Boundary Map

| Module | I/O Type | Boundary | Testability |
|--------|----------|----------|-------------|
| `lib/types.ts` | None (pure types) | -- | Trivial |
| `lib/normalize.ts` | None (pure functions) | -- | Easy |
| `lib/config.ts` | Reads `process.env` | Environment | Easy |
| `vendors/registry.ts` | Reads `catalog.json` | Filesystem | Easy |
| `db/schema.ts` | None (schema defs) | -- | Trivial |
| `db/client.ts` | Creates SQLite file | Filesystem + SQLite | Medium |
| `db/queries.ts` | DB reads/writes | Database | Easy (`:memory:`) |
| `db/board-queries.ts` | DB reads/writes | Database | Easy (`:memory:`) |
| `db/observation-queries.ts` | DB reads/writes | Database | Easy (`:memory:`) |
| `ingestion/*.ts` | `fetch()` to external URL | Network | Medium (MSW) |
| `alerts/*.ts` | `fetch()` to webhook | Network | Medium (MSW) |
| `restate/projector.ts` | DB reads/writes | Database | Easy (no Restate dep) |
| `restate/poller.ts` | Restate + DB + fetch | Restate + DB + Network | Hard |
| `restate/alerter.ts` | Restate + DB + fetch | Restate + DB + Network | Hard |
| `api/routes/*.ts` | Hono req/res + DB | HTTP + Database | Easy (Hono test client) |
| `mock/board-scenarios.ts` | DB writes | Database | Easy (`:memory:`) |
| `mock/seed-history.ts` | DB writes | Database | Easy (`:memory:`) |
| `vision/detect.ts` | Anthropic API | Network | Medium (MSW) |
| `mcp/server.ts` | MCP SDK + DB | MCP + Database | Medium |

### Key Insight: The Projector is Fully Testable

Unlike the Restate handlers, `projector.ts` has no SDK coupling. It reads/writes the DB and returns events. Tests create an in-memory DB, seed boards/monitors/components, call `projectServiceUpdate()`, and assert on the returned events and written observations.

---

## Data Flow Traces

### Flow 1: Polling Cycle with Projection

```
Scheduler.run()
  → for each vendor in catalog: send delayed Poller[vendor.id].poll()

Poller[vendor.id].poll()
  → dispatch by ingestion type → fetchStatuspageSummary / fetchRssFeed / scrape / runPlugin
  → normalize → persist canonical data (services, components, incidents)
  → projector.projectServiceUpdate(serviceId, vendorName)
    → for each boardMonitor referencing this service:
        → computeMonitorStatus(monitor) using component filter
        → if changed: recordObservation, emit StatusChangeEvent
  → for each event: alerter.alert(event)
    → getBoardAlertTargetsForMonitor(monitorId) → fan-out to targets
  → self-reschedule
```

### Flow 2: Public Status Page

```
GET /api/boards/:slug/public  (no auth)
  → getBoardBySlug(slug)
  → listBoardMonitors(boardId) → filter enabled + showOnStatusPage
  → computeMonitorStatus() for each → worstStatus() for aggregate
  → gather active incidents from monitored services
  → return { board, status, monitors, activeIncidents }
```

### Flow 3: Mock Scenario Application

```
POST /api/mock/boards/:boardId/scenarios/:name
  → listBoardMonitors(boardId) → capture pre-scenario statuses
  → applyScenario(name) → returns vendor states
  → write states into services + components tables
  → recompute each monitor's status via computeMonitorStatus()
  → if changed: recordObservation(source: "mock")
  → return { applied, changes: [{ monitorName, from, to }] }
```

### Flow 4: History Seeding

```
POST /api/mock/seed-history { boardId, days: 30 }
  → listBoardMonitors(boardId)
  → for each monitor with a providerServiceId:
    → generate 2-5 random incidents over the period
    → for each: write statusChange + observation (down + recovery)
  → return { observations: count }
```

---

## Testability Assessment Summary

### Fully Testable (No Changes Needed)
- `lib/normalize.ts`, `lib/types.ts`, `vendors/registry.ts`, `db/schema.ts`
- `db/queries.ts`, `db/board-queries.ts`, `db/observation-queries.ts` — use `:memory:` DB
- `restate/projector.ts` — pure DB logic, no Restate coupling
- `mock/board-scenarios.ts`, `mock/seed-history.ts` — DB writes only

### Testable with MSW
- All `ingestion/*.ts`, `alerts/*.ts`, `vision/detect.ts` — use global `fetch()`

### Testable via Hono Test Client
- All `api/routes/*.ts` — mount on test Hono app with `:memory:` DB

### Skip (Restate SDK coupling)
- `restate/poller.ts`, `restate/alerter.ts`, `restate/scheduler.ts` — business logic extracted to testable functions; these are thin orchestration wrappers
