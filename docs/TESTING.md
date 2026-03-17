# StatusPulse Test Strategy

## Test Pyramid

```
         ╱ ╲
        ╱ E2E ╲          Docker Compose smoke test (manual/CI)
       ╱───────╲
      ╱  Integ  ╲        MSW + in-memory DB: ingestion, alerts, API routes
     ╱───────────╲
    ╱    Unit     ╲       Pure functions: normalize, registry, config
   ╱───────────────╲
  ╱   Storybook     ╲    Visual: all UI components in isolation
 ╱───────────────────╲
```

## Tools

| Tool | Purpose | Where |
|------|---------|-------|
| **Vitest** | Test runner for backend + frontend | `vitest.config.ts` (root workspace) |
| **MSW 2.x** | Network-level HTTP mocking | `src/test/msw/` |
| **Storybook 8** | UI component stories | `web/.storybook/` |
| **React Testing Library** | Component render tests | `web/src/**/*.test.tsx` |
| **@testing-library/react** | React render helpers | Frontend tests |

## Directory Structure

```
statuspulse/
├── vitest.config.ts              # workspace config (backend + web)
├── src/
│   └── test/
│       ├── setup.ts              # global test setup (MSW server start)
│       ├── db.ts                 # in-memory test DB factory
│       ├── msw/
│       │   ├── server.ts         # MSW setupServer
│       │   ├── handlers.ts       # default request handlers
│       │   └── fixtures/
│       │       ├── statuspage-github.json
│       │       ├── statuspage-stripe.json
│       │       ├── rss-aws.xml
│       │       └── rss-slack.xml
│       ├── lib/
│       │   ├── normalize.test.ts
│       │   └── config.test.ts
│       ├── vendors/
│       │   └── registry.test.ts
│       ├── ingestion/
│       │   ├── statuspage-api.test.ts
│       │   ├── rss.test.ts
│       │   ├── scraper.test.ts
│       │   └── plugin-runner.test.ts
│       ├── alerts/
│       │   ├── slack.test.ts
│       │   └── http-webhook.test.ts
│       ├── db/
│       │   └── operations.test.ts
│       └── api/
│           ├── services.test.ts
│           ├── incidents.test.ts
│           ├── status.test.ts
│           ├── alert-targets.test.ts
│           ├── plugins.test.ts
│           └── auth.test.ts
├── src/mock/
│   ├── mode.ts                   # MOCK_MODE entry point
│   ├── data.ts                   # fixture data for all vendors
│   ├── scenarios.ts              # named scenarios (all-green, outage, etc.)
│   └── server.ts                 # MSW server for mock mode
└── web/
    ├── .storybook/
    │   ├── main.ts
    │   └── preview.ts
    └── src/
        ├── components/
        │   ├── status-dot.stories.tsx
        │   ├── overview-banner.stories.tsx
        │   ├── service-grid.stories.tsx
        │   └── incidents-list.stories.tsx
        └── __tests__/
            ├── setup.ts
            ├── use-api.test.ts
            ├── status-dot.test.tsx
            ├── service-grid.test.tsx
            └── incidents-list.test.tsx
```

---

## Mock Mode Design

### Purpose
Mock mode intercepts all outbound `fetch()` calls at the network level using MSW. This enables:
1. **Fast demo/ROI showcases** — no real vendor polling, instant status changes
2. **Offline development** — no network dependencies
3. **Integration testing** — deterministic responses
4. **Scenario simulation** — trigger outage/degraded/maintenance scenarios on demand

### Activation
```bash
MOCK_MODE=true npx tsx src/index.ts
```

### Scenario API
```
POST /api/mock/scenario/:name    # Switch to named scenario
GET  /api/mock/scenarios         # List available scenarios
POST /api/mock/vendor/:id/status # Override single vendor status
```

### Predefined Scenarios

| Scenario | Description |
|----------|-------------|
| `all-green` | All 53 vendors operational |
| `github-outage` | GitHub major outage, 2 incidents |
| `multi-degraded` | GitHub, Stripe, Vercel degraded |
| `cloud-cascade` | AWS outage → cascading to Vercel, Netlify, Heroku |
| `maintenance-window` | GitHub, Cloudflare scheduled maintenance |
| `mixed-reality` | Realistic mix: most green, 2 degraded, 1 maintenance |

### MSW Handler Strategy
Each handler serves a canned statuspage/RSS response. Scenario changes swap which response set is active. The handler checks a global `currentScenario` variable and returns the appropriate fixture.

---

## What to Test Per Module

### lib/normalize.ts (Unit)
- `normalizeStatuspageIndicator`: all 12 indicator strings → correct status
- `normalizeStatuspageComponentStatus`: same mapping, exercised separately
- `normalizeFromText`: regex patterns — positive/negative for each status
- `worstStatus`: empty array, single status, mixed statuses, all combinations
- Edge cases: unknown strings default to `operational`

### lib/config.ts (Unit)
- Default values when env vars unset
- Override each field via env
- Zod validation errors for invalid types (e.g. API_PORT="abc")

### vendors/registry.ts (Unit)
- `getAllVendors()`: returns 53 entries, each has required fields
- `getEnabledVendors()`: subset with `defaultEnabled: true`
- `getVendorById("github")`: returns correct vendor
- `getVendorById("nonexistent")`: returns undefined
- `getVendorsByCategory("cloud")`: correct filter
- `searchVendors("git")`: matches GitHub, GitLab
- `searchVendors("STRIPE")`: case-insensitive

### ingestion/statuspage-api.ts (Integration w/ MSW)
- Happy path: parse full summary.json → correct status, components, incidents
- Components: filters out group children
- Region extraction: "US East" → "us-east", "EU West" → "eu-west"
- Error: 500 response → throws
- Error: timeout → throws
- Error: malformed JSON → throws

### ingestion/rss.ts (Integration w/ MSW)
- RSS 2.0 format: parse items → correct incidents
- Atom format: parse entries → correct incidents
- Status derivation: no recent incidents → operational
- Status derivation: recent outage item → outage
- Empty feed: returns operational
- Malformed XML: throws

### ingestion/scraper.ts (Integration w/ MSW)
- Custom selector: extracts correct text
- Default selectors: tries common patterns
- Status detection from scraped text
- Error: 404 → throws

### ingestion/plugin-runner.ts (Integration w/ MSW)
- Custom statusPath: extracts nested JSON value
- Custom statusMapping: maps custom → normalized
- Default paths: tries status.indicator, status, state, health
- Fetch failure: returns outage status

### alerts/slack.ts (Integration w/ MSW)
- Correct Block Kit structure
- All 4 status emoji mappings
- All 16 status transition combinations (4×4)
- Webhook failure: throws

### alerts/http-webhook.ts (Integration w/ MSW)
- Correct JSON payload shape
- HMAC-SHA256 signature correctness (verify with crypto)
- No secret: no signature header
- Webhook failure: throws

### db/ (Integration w/ in-memory SQLite)
- CRUD on all 6 tables
- Foreign key constraints (incident → service)
- onConflictDoUpdate behavior
- Default values (created_at, status)
- Boolean columns (enabled)

### api/routes/* (Integration w/ Hono test + in-memory DB)
- GET /api/services: returns seeded services, filter by region/category
- GET /api/services/:id: returns service + components, 404 for missing
- POST /api/services: creates from catalog vendor
- GET /api/incidents: active only by default, filter by vendor/region
- GET /api/status: correct aggregation, byCategory, byRegion
- POST /api/alert-targets: creates target, returns id
- DELETE /api/alert-targets/:id: removes target
- POST /api/plugins: creates plugin + service entry
- Auth middleware: none mode passes, api-key rejects without key, bearer rejects without token

### Frontend Components (Storybook + RTL)
- StatusDot: renders correct CSS class per status × size
- Badge: renders correct variant styling
- OverviewBanner: displays correct message/icon per overall status
- ServiceGrid: groups by category, filters by region/category, shows empty state
- IncidentsList: shows empty state, renders incident cards with correct data
- App: full integration with mocked API responses

---

## Coverage Goals

| Layer | Target | Rationale |
|-------|--------|-----------|
| lib/ | 100% | Pure functions, no excuse |
| vendors/ | 100% | Pure query functions |
| ingestion/ | 90%+ | All paths except obscure XML edge cases |
| alerts/ | 95%+ | Critical path, must verify payloads |
| api/routes/ | 90%+ | All CRUD operations + auth |
| db/ | 85%+ | Schema + operations |
| Frontend components | 80%+ | All visual states |
| Restate handlers | 0% | Skipped (Restate SDK coupling) |
| MCP server | 0% | Skipped (MCP SDK coupling) |

---

## Running Tests

```bash
# All backend tests
npm test

# All frontend tests
npm run test:web

# Storybook
cd web && npm run storybook

# Mock mode (for demos)
MOCK_MODE=true npm run dev

# Coverage report
npm run test:coverage
```
