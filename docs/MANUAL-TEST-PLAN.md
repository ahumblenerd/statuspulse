# StatusPulse — Manual Test Plan

Run through this end-to-end before shipping. Estimated time: 45-60 minutes.

## Prerequisites

```bash
npm install
cd web && npm install && cd ..
cd web && npx vite build && cd ..
```

---

## Phase 1: Boot & Smoke (5 min)

### 1.1 Start in mock mode
```bash
MOCK_MODE=true npm run dev
```
- [ ] Console shows the startup banner with API/MCP/Restate ports
- [ ] No crash, no unhandled errors
- [ ] Mock mode message shows "all-green" scenario

### 1.2 Health check
```bash
curl http://localhost:3000/health
```
- [ ] Returns `{"ok":true,"timestamp":"..."}`

### 1.3 Frontend loads
- [ ] Open http://localhost:3000 in browser
- [ ] Sidebar renders with 5 nav items (Dashboard, Services, Incidents, Alerts, Plugins)
- [ ] Dashboard page loads (may show empty state initially)

---

## Phase 2: Service Management (10 min)

### 2.1 Browse catalog
- [ ] Navigate to **Services** page
- [ ] Click **Add Service** button
- [ ] Dialog opens showing vendor catalog
- [ ] Search for "github" — filters correctly
- [ ] Search for "stripe" — filters correctly
- [ ] All 50+ vendors are listed when search is empty

### 2.2 Add services
- [ ] Click "Add" on GitHub → success, dialog stays open
- [ ] Click "Add" on Stripe → success
- [ ] Click "Add" on Vercel → success
- [ ] Close dialog
- [ ] Services page shows 3 service cards
- [ ] Each card shows StatusDot, name, category badge, region badge

### 2.3 Verify via API
```bash
curl http://localhost:3000/api/services | python3 -m json.tool
```
- [ ] Returns 3 services with correct names and categories

### 2.4 Service detail
- [ ] Click on a service card → navigates to `/services/:id`
- [ ] Shows service name, status, description
- [ ] Shows components list (may be empty until first poll)
- [ ] Shows uptime chart (100% with no changes yet)
- [ ] Back link works → returns to `/services`

### 2.5 Toggle service
- [ ] Toggle the enable/disable switch on a service card
- [ ] Service immediately updates (grayed out or restored)

### 2.6 Delete service
- [ ] Click the trash icon on a service → service disappears
- [ ] Verify with API: `curl http://localhost:3000/api/services`

---

## Phase 3: Mock Scenarios (10 min)

### 3.1 Trigger GitHub outage
```bash
curl -X POST http://localhost:3000/api/mock/scenario/github-outage
```
- [ ] Wait 15 seconds for the dashboard to auto-refresh
- [ ] Dashboard banner should change from green to red/yellow
- [ ] GitHub service card should show outage/degraded status
- [ ] Incidents tab should show GitHub incidents

### 3.2 Cloud cascade
```bash
curl -X POST http://localhost:3000/api/mock/scenario/cloud-cascade
```
- [ ] Multiple services show degraded/outage
- [ ] Category breakdown on dashboard reflects the cascade
- [ ] Incidents list populates

### 3.3 Return to green
```bash
curl -X POST http://localhost:3000/api/mock/scenario/all-green
```
- [ ] Wait for refresh → all services return to operational
- [ ] Dashboard banner turns green
- [ ] Incidents list clears (resolved)

### 3.4 Override single vendor
```bash
curl -X POST http://localhost:3000/api/mock/vendor/stripe/status \
  -H 'Content-Type: application/json' -d '{"status":"outage"}'
```
- [ ] Stripe shows outage while others stay green

---

## Phase 4: Dashboard (5 min)

- [ ] Status banner shows overall status with correct color (green/yellow/red/blue)
- [ ] Stats cards show: Total Services, Active Incidents, Overall Status, Last Updated
- [ ] Category breakdown grid shows each category with StatusDot + count
- [ ] Region breakdown shows regions with aggregate status
- [ ] Recent incidents section shows top 5 (if any active)
- [ ] Clicking an incident navigates to incident detail
- [ ] Page auto-refreshes (check "Last Updated" time advances every 15s)
- [ ] Animations play on page load (fade-in, staggered cards)

---

## Phase 5: Incidents (5 min)

### 5.1 Incidents list
- [ ] Navigate to **Incidents** page
- [ ] If scenarios were run, incidents appear
- [ ] Toggle "Show all" to see resolved incidents
- [ ] Vendor filter works (type a service ID)
- [ ] Each incident card shows: StatusDot, title, service badge, impact badge, timestamps

### 5.2 Incident detail
- [ ] Click an incident → navigates to `/incidents/:id`
- [ ] Shows incident title, status, impact, service ID
- [ ] Shows timeline of updates (if any) with vertical line design
- [ ] External link to shortlink works (if present)
- [ ] Back link returns to `/incidents`

---

## Phase 6: Alert Targets (10 min)

### 6.1 Create Slack target
- [ ] Navigate to **Alerts** page
- [ ] Click **Add Alert**
- [ ] Select "Slack" type
- [ ] Enter name: "Engineering"
- [ ] Enter URL: `https://hooks.slack.com/services/T00/B00/xxx`
- [ ] Click Create
- [ ] Alert target card appears in the list

### 6.2 Create Teams target
- [ ] Click **Add Alert** again
- [ ] Select "Teams" type (verify it's an option — new feature)
- [ ] Enter name: "Ops Team"
- [ ] Enter URL: `https://outlook.office.com/webhook/xxx`
- [ ] Click Create
- [ ] Two alert targets now in list

### 6.3 Create Webhook target
- [ ] Click **Add Alert**
- [ ] Select "Webhook" type
- [ ] Enter name, URL, and a secret
- [ ] Optionally set filter region or category
- [ ] Click Create

### 6.4 Test alert (will fail with fake URLs — that's OK)
- [ ] Click "Test" button on a target
- [ ] Button shows loading state
- [ ] Returns error (since URLs are fake) — verify it doesn't crash the app

### 6.5 Delete target
- [ ] Click trash icon on a target → target disappears
- [ ] Verify via API: `curl http://localhost:3000/api/alert-targets`

---

## Phase 7: Plugins (5 min)

### 7.1 Create plugin
- [ ] Navigate to **Plugins** page
- [ ] Click **Add Plugin**
- [ ] Fill in:
  - Name: "httpbin test"
  - URL: `https://httpbin.org/json`
  - Status Path: `slideshow.title`
  - Healthy value: `Sample Slide Show`
  - Unhealthy value: `error`
- [ ] Click Create
- [ ] Plugin card appears with name, type badge, URL

### 7.2 Verify plugin created a service
```bash
curl http://localhost:3000/api/services?enabled=false | python3 -m json.tool
```
- [ ] A service entry exists for the plugin ID

### 7.3 Delete plugin
- [ ] Click trash icon → plugin disappears
- [ ] Verify the associated service is also deleted

---

## Phase 8: Public Status Page (5 min)

- [ ] Open http://localhost:3000/status in a **new tab** (or incognito)
- [ ] Page loads with its own layout (no sidebar)
- [ ] Shows "System Status" header with StatusPulse logo
- [ ] Overall status banner with correct color
- [ ] Services grouped by category with StatusDot + name + status badge
- [ ] Active incidents section (if any)
- [ ] Footer shows "Powered by StatusPulse" and last updated time
- [ ] Page auto-refreshes (check timestamp advances)
- [ ] No auth required — works in incognito

---

## Phase 9: Uptime History (3 min)

### 9.1 Generate some history
```bash
# Switch scenarios to create status changes
curl -X POST http://localhost:3000/api/mock/scenario/github-outage
sleep 5
curl -X POST http://localhost:3000/api/mock/scenario/all-green
sleep 5
```

### 9.2 Check history API
```bash
curl http://localhost:3000/api/history/github | python3 -m json.tool
```
- [ ] Returns `changes` array (may have entries after scenario switches)
- [ ] Returns `uptime.percentage` (number)
- [ ] Returns `dailyUptime` array with 30 entries

### 9.3 Check chart in UI
- [ ] Navigate to **Services** → click a service
- [ ] Uptime chart component renders
- [ ] Shows uptime percentage badge
- [ ] Area chart renders (even if flat 100%)

---

## Phase 10: API Spec & MCP (2 min)

### 10.1 OpenAPI spec
```bash
curl http://localhost:3000/api/openapi.json | python3 -m json.tool | head -20
```
- [ ] Returns valid OpenAPI 3.1 spec
- [ ] Contains all endpoints

### 10.2 MCP server
```bash
curl http://localhost:3001/mcp -X POST \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test"}},"id":1}'
```
- [ ] Returns MCP initialize response (or connection info)

---

## Phase 11: Responsive & Polish (3 min)

- [ ] Resize browser to mobile width (~375px)
- [ ] Bottom navigation bar appears (5 icons)
- [ ] Sidebar hides
- [ ] All pages are usable at mobile width
- [ ] Dialogs render correctly on mobile
- [ ] Status dots glow correctly in dark mode
- [ ] Outage status dots pulse

---

## Phase 12: Auth Mode (2 min)

### 12.1 Stop server, restart with auth
```bash
# Kill existing
AUTH_MODE=api-key API_KEY=test-secret-key MOCK_MODE=true npm run dev
```

### 12.2 Unauthenticated request rejected
```bash
curl http://localhost:3000/api/services
```
- [ ] Returns 401

### 12.3 Authenticated request works
```bash
curl http://localhost:3000/api/services -H 'X-API-Key: test-secret-key'
```
- [ ] Returns 200 with services

### 12.4 Public endpoints still work without auth
```bash
curl http://localhost:3000/api/public/status
curl http://localhost:3000/health
```
- [ ] Both return 200

---

## Summary Checklist

| Phase | Area | Pass? |
|-------|------|-------|
| 1 | Boot & smoke | [ ] |
| 2 | Service management (CRUD) | [ ] |
| 3 | Mock scenarios | [ ] |
| 4 | Dashboard display | [ ] |
| 5 | Incidents list + detail | [ ] |
| 6 | Alert targets (CRUD + test) | [ ] |
| 7 | Plugins (CRUD) | [ ] |
| 8 | Public status page | [ ] |
| 9 | Uptime history | [ ] |
| 10 | API spec + MCP | [ ] |
| 11 | Responsive + polish | [ ] |
| 12 | Auth mode | [ ] |

## Known Expectations

- Mock mode does NOT start the Restate polling loop automatically (Restate server is a separate process). Services will show "operational" with no `lastCheckedAt` until polled.
- Test alert will fail with fake webhook URLs — expected behavior.
- Uptime chart may show flat 100% if no status changes have occurred.
- The frontend dev server (Vite) proxies to port 3000. For testing the built app, use `cd web && npx vite build` first, then the SPA is served directly from the API server.
