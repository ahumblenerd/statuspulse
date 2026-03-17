# StatusPulse — Fixes Tracker

All issues identified in the product review and deep audit, tracked to resolution.

---

## Round 1: Product Review Fixes

### P0 — Critical Bugs

#### 1. Alert filter logic is empty (alerter.ts)
- **File**: `src/restate/alerter.ts`
- **Issue**: `filterRegion` and `filterCategory` fields exist in schema and API, but the filter branch body was empty — all targets received all alerts
- **Status**: FIXED
- **Fix**: Implemented region/category filter matching. Added `region` and `category` to `StatusChangeEvent`.

#### 2. Inbound webhook has no signature verification
- **File**: `src/ingestion/webhook-receiver.ts`
- **Issue**: `POST /api/webhooks/inbound/:vendorId` accepts arbitrary JSON with zero auth
- **Status**: FIXED
- **Fix**: Added HMAC-SHA256 signature verification via `X-StatusPulse-Signature` header.

#### 3. `process.env` used instead of typed config
- **Files**: `src/api/routes/alert-targets.ts`, `src/api/routes/plugins.ts`
- **Status**: FIXED — Replaced with `config.RESTATE_INGRESS_URL`.

### P1 — Important Bugs

#### 4. `any` type in plugins PATCH handler
- **Status**: FIXED — Replaced with `Partial<{ name: string; config: string; enabled: boolean }>`.

#### 5. Mock scenario comment is wrong
- **Status**: FIXED — Changed "AWS is down" to "DigitalOcean is down" to match code.

#### 6. Docker setup race condition
- **Status**: FIXED — Replaced `sleep 5` with health-check retry loop (30 attempts).

### P2 — Missing Tests

#### 7-11. Test suite gaps
- **7**: Auth middleware — added api-key/bearer rejection+acceptance tests
- **8**: Scraper — added 404 error test
- **9**: Config — added Zod validation error test
- **10**: Webhook receiver — created full test suite (signature verification, all formats)
- **11**: Upload/detect — created test suite (vision detection, missing API key)

---

## Round 2: Deep Orchestration Audit Fixes

### P0 — Critical Bugs

#### 12. Plugin poller error handling improved
- **File**: `src/restate/poller.ts`
- **Issue**: Error handling in plugin poll path used raw `err` logging. Clarified that reschedule is outside try/catch with explicit comment.
- **Status**: FIXED — Added `instanceof Error` narrowing, explicit comment about reschedule placement.

#### 13. Webhook receiver bypasses alerter (silent status changes)
- **File**: `src/ingestion/webhook-receiver.ts`
- **Issue**: Inbound webhooks wrote directly to DB without firing alerts. Status changes via webhook were completely silent.
- **Status**: FIXED — Added `fireAlertIfChanged()` that reads previous status, compares, and fires alert via Restate ingress HTTP.

#### 14. Unsafe PATCH body in services route (security)
- **File**: `src/api/routes/services.ts`
- **Issue**: `db.update(services).set(body)` passed raw request body to Drizzle — attacker could overwrite `id`, `vendorId`, or any column.
- **Status**: FIXED — Whitelisted allowed fields: `name`, `category`, `region`, `enabled`.

### P1 — New Capabilities (Proactive Orchestration)

#### 15. Status change history table
- **Files**: `src/db/schema.ts`, `src/db/client.ts`, `src/db/queries.ts`
- **Issue**: No status history existed. Every poll overwrote the single services row. Impossible to compute uptime, MTTR, or draw timelines.
- **Status**: FIXED — Added `status_changes` table. `persistStatus()` now records a history row on every status transition.

#### 16. Synthetic health check probes
- **Files**: `src/ingestion/probe.ts` (new), `src/db/schema.ts`, `src/db/queries.ts`, `src/restate/poller.ts`
- **Issue**: The orchestrator only read self-reported status pages. No independent verification of vendor health.
- **Status**: FIXED — Added `probeEndpoint()` function that does a lightweight HEAD request to the vendor's status page URL. Results stored in `probe_results` table (httpStatus, latencyMs, ok, error). Integrated into the poller's poll cycle.

#### 17. Stale data detection in status API
- **File**: `src/api/routes/status.ts`
- **Issue**: If a poller died silently, the API continued serving stale data with no indication.
- **Status**: FIXED — Added `staleServices` count to status API response. A service is stale if `lastCheckedAt` > 5 minutes old.

#### 18. RSS/Atom mock scenario support
- **Files**: `src/mock/server.ts`, `src/mock/data.ts`, `src/mock/scenarios.ts`
- **Issue**: Mock mode served empty RSS feeds for AWS/GCP/etc, so they always showed operational. Impossible to simulate outages for RSS-based vendors.
- **Status**: FIXED — Mock RSS handlers now generate XML with incident entries (using keywords like "disruption", "unavailable", "degraded") when the vendor's mock state is non-operational. Added AWS and GCP to mock vendor list. Updated `cloud-cascade` scenario to include AWS outage.

### P2 — Type Safety & Code Quality

#### 19. RSS incident IDs are positional (data integrity bug)
- **File**: `src/ingestion/rss.ts`
- **Issue**: Used array index as incident ID (`vendorId-rss-${i}`). When feed items shifted, IDs changed, creating duplicates.
- **Status**: FIXED — Replaced with SHA-256 hash of `vendorId:guid:pubDate` for stable IDs.

#### 20. Dead code: regionComponents computed but never used
- **File**: `src/ingestion/statuspage-api.ts`
- **Issue**: Lines 68-84 computed region data from component names but the variable was never returned or persisted.
- **Status**: FIXED — Removed dead code and unused `extractRegion` function. Removed unused `IncidentUpdate` import.

#### 21. All `err: any` catch clauses → `err: unknown`
- **Files**: `alerter.ts`, `upload.ts`, `alert-targets.ts`, `mock/server.ts`, `poller.ts`
- **Status**: FIXED — Replaced with `err: unknown` + `instanceof Error` narrowing.

#### 22. All unused imports removed
- `incidents.ts`: removed `isNull`, `isNotNull`
- `scraper.ts`: removed `NormalizedStatus`, `NormalizedStatusType`
- `schema.ts`: removed `real`
- `statuspage-api.ts`: removed `IncidentUpdate`
- `normalize.test.ts`: removed `NormalizedStatus`
- `slack.test.ts`: removed `vi`

#### 23. `persistIncidents` type safety
- **File**: `src/db/queries.ts`
- **Issue**: Accepted `any[]` parameter, losing all type safety.
- **Status**: FIXED — Now accepts `Incident[]` with proper imports.

---

## Verification Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | 0 errors, 18 warnings (all pre-existing console.log/any in Restate handlers) |
| `npm test` | 134 tests PASS (was 121 originally) |
| `npm run test:web` | 19 tests PASS |

### New Tables Added
- `status_changes` — tracks every status transition with timestamps
- `probe_results` — stores synthetic HTTP probe results per poll cycle

### New Files Created
- `src/ingestion/probe.ts` — synthetic health check probe
- `src/test/ingestion/webhook-receiver.test.ts` — webhook receiver tests
- `src/test/api/upload.test.ts` — upload/detect route tests
- `docs/GTM-STRATEGY.md` — GTM strategy and product roadmap

### Warnings Reduced
- Was: 31 lint warnings
- Now: 18 lint warnings (13 eliminated)
