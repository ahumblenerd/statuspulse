# StatusPulse — GTM Strategy & Product Roadmap

Working backward from the end state: StatusPulse is the default status aggregation layer for engineering teams that depend on third-party SaaS infrastructure.

---

## Part 1: Strategic Questions Answered

### Should we use a proper webhook gateway?

**Yes, but not yet.** Right now inbound webhooks go directly to the Hono route. This works for <50 vendors but doesn't scale for enterprise.

**Phase 1 (now):** HMAC signature verification (done). Rate limiting per vendorId. Request logging.

**Phase 2 (enterprise):** Front webhooks with a proper gateway (Kong, AWS API Gateway, or Cloudflare Workers). Benefits:
- Rate limiting, DDoS protection
- Request/response logging and replay
- Schema validation before hitting the app
- Multi-region ingress

**Recommendation:** Don't over-architect yet. Add rate limiting middleware in Hono (`hono/rate-limit`) for now. Gateway comes when you have paying customers who need SLAs.

### How easy/hard is it to add new vendors?

**Trivially easy** — this is the product's strongest design decision.

1. Open `src/vendors/catalog.json`
2. Add a JSON object with `id`, `name`, `category`, `statusPageUrl`, `ingestion.type`, `ingestion.url`
3. No code changes needed if the vendor uses `statuspage-api`, `rss`, `atom`, or `scrape`
4. Run tests — the MSW catch-all handler auto-generates operational responses for any new statuspage vendor

**~40 of the 50 vendors use Atlassian Statuspage** (the `statuspage-api` type), which means adding most new vendors takes <30 seconds.

**Gap:** No UI for adding vendors. Users must edit JSON or curl the API. Adding a vendor management UI would reduce friction to near-zero.

### How easy/hard is it to support a custom vendor?

**Moderate** — the plugin system handles this via API:

```bash
curl -X POST localhost:3000/api/plugins -d '{
  "id": "my-api",
  "type": "custom-api",
  "config": {
    "url": "https://my-api.com/health",
    "statusPath": "status.overall",
    "statusMapping": { "healthy": "operational", "unhealthy": "outage" }
  }
}'
```

**What works:** JSON health endpoints with dot-notation path extraction and custom status mapping.

**What doesn't work:** GraphQL endpoints, OAuth-protected endpoints (only static headers), endpoints that need request bodies, multi-step health checks, endpoints that return HTML.

**To improve:**
- Add `custom-graphql` plugin type
- Add OAuth2 client-credentials flow for authenticated endpoints
- Add `custom-script` type that runs user-provided JavaScript in a sandbox (V8 isolate)
- Add plugin templates in the UI

### What should we remove?

| Remove | Why |
|--------|-----|
| `dist-web/` from git | Causes merge conflicts, bloats repo. Build in CI instead |
| `real` import in `db/schema.ts` | Unused, generates lint warning |
| `isNull`/`isNotNull` imports in `incidents.ts` | Unused |
| `NormalizedStatus`/`NormalizedStatusType` imports in `scraper.ts` | Unused |
| `IncidentUpdate` import in `statuspage-api.ts` | Unused |
| `incidentUpdates` import in `webhook-receiver.ts` | Already fixed |
| Vision detection as a core feature | Move to optional plugin — most users won't have an Anthropic API key, and it adds a paid dependency for a feature that's mostly a demo |

### What will make this solution better?

**High-impact, moderate-effort improvements:**

1. **Historical data & uptime tracking** — Store status changes as time-series events. Show "99.95% uptime over 90 days" per vendor. This transforms the product from "what's happening now" to "how reliable is my stack" — 10x more valuable.

2. **Admin UI** — Vendor management, plugin CRUD, alert target configuration, all from the dashboard. Currently everything requires curl.

3. **PostgreSQL support** — The `DATABASE_URL` env var exists but is unused. Add Drizzle PostgreSQL driver support behind a flag. Enterprise customers won't accept SQLite.

4. **Synthetic monitoring** — Don't just trust vendor status pages (they lie). Add HTTP ping checks, TCP port checks, DNS resolution checks. "Vendor says operational but our pings show 500ms latency" is incredibly valuable signal.

5. **Incident correlation** — When AWS goes down and Vercel degrades 5 minutes later, show the cascade. The `cloud-cascade` mock scenario proves this is a real pattern.

6. **Manual status override** — Let team leads mark a service as "actually down" even when the vendor page says operational.

### How do we take it to enterprise standards?

| Requirement | Current State | What's Needed |
|------------|---------------|---------------|
| **Auth** | Single shared API key | OIDC/SAML SSO, RBAC (admin/viewer/operator), per-user API keys |
| **Audit trail** | None | Log all config changes with user, timestamp, diff |
| **Multi-tenancy** | Single tenant | Workspace/org isolation, per-tenant DB or row-level security |
| **HA/DR** | Single SQLite file | PostgreSQL with replicas, multi-region deployment |
| **Data retention** | Forever (SQLite grows) | Configurable retention policies, data archival |
| **Compliance** | None | SOC2 audit logging, data residency controls, encryption at rest |
| **SLA** | None | 99.9% uptime guarantee on the monitoring platform itself |
| **On-prem** | Docker only | Helm chart, Terraform modules, AMI/VM images |
| **Integrations** | Slack + webhooks | PagerDuty, OpsGenie, Teams, email, Jira, Linear |

### How do we ensure all vendors can be mocked?

**Current state:** Mock mode covers statuspage-api vendors well (19 demo vendors with full component breakdown). RSS/Atom vendors always show operational in mock mode (empty feed = no incidents).

**Improvements needed:**

1. **RSS/Atom mock support** — Generate mock RSS items with incident keywords to test non-operational states for AWS/GCP/Azure/Firebase/Slack
2. **Scrape mock support** — Generate mock HTML pages with degraded/outage selectors
3. **Auto-mock for new vendors** — When a vendor is added to catalog.json, auto-generate a mock handler based on its ingestion type
4. **Mock data recorder** — Record real vendor responses and replay them in mock mode (like VCR/Polly.js)
5. **Per-vendor scenario API** — Already partially exists (`POST /api/mock/vendor/:id/status`), but only sets status, not incidents or components

### Can we see original/raw data?

**Currently: No.** All data is normalized before storage. The raw vendor response is discarded.

**What to add:**
1. **Raw response storage** — Save the last raw response per vendor (in a `raw_responses` table or S3-compatible storage)
2. **Debug view** — `/api/services/:id/raw` endpoint that returns the last raw response
3. **Diff view** — Show what changed between the last two polls
4. **Response history** — Keep last N responses for debugging normalization issues

### PostgreSQL support?

**Currently:** `DATABASE_URL` is in `.env.example` but unused. Everything uses `better-sqlite3`.

**Implementation plan:**
1. Drizzle already supports PostgreSQL via `drizzle-orm/postgres-js`
2. Add `pg` and `postgres` packages
3. Create `src/db/pg-client.ts` alongside `client.ts`
4. Switch on `DATABASE_URL` presence: if set, use Postgres; otherwise, SQLite
5. Schema definitions in `schema.ts` need minor changes (SQLite `integer` boolean → Postgres `boolean`)
6. Use Drizzle migrations for schema management (replace raw DDL)
7. Add `docker-compose.postgres.yml` with a Postgres service

**Effort:** ~2-3 days for basic support. 1 week for migration tooling and testing.

---

## Part 2: GTM Strategy (Traction Framework)

Using the 19 traction channels from Gabriel Weinberg's *Traction*, here's how StatusPulse can gain initial traction:

### Target Market Definition

**Beachhead segment:** Engineering teams (5-50 devs) at SaaS companies who:
- Depend on 10+ third-party services
- Have experienced incidents caused by vendor outages they didn't know about
- Already use Slack for ops communication
- Value self-hosted solutions (data control, no vendor lock-in)

**ICP:** VP of Engineering or SRE Lead at a Series A-C startup with 20-100 employees.

### Bullseye Framework: Top 3 Channels

#### 1. Engineering Blogs / Content Marketing (Inner Ring)

**Why:** The target audience actively reads engineering blogs and follows "how we built X" content.

**Actions:**
- Publish "How we monitor 50+ SaaS dependencies with zero vendor lock-in" on the company blog
- Write "Why your status page is lying to you" — data analysis comparing vendor-reported uptime vs actual user-experienced downtime
- "Building a durable polling system with Restate" — technical deep-dive that attracts Restate community
- "MCP for infrastructure: Teaching AI agents about your stack's health" — rides the AI agent wave
- Cross-post to Hacker News, dev.to, r/devops, r/selfhosted

**Metric:** 1,000 GitHub stars in first 90 days

#### 2. Community Building / Open Source (Inner Ring)

**Why:** Self-hosted + open source is the distribution model. The community IS the GTM.

**Actions:**
- Launch on Hacker News with "Show HN: Self-hosted status aggregator with MCP for AI agents"
- Create a Discord/Slack community for users
- Maintain a public vendor catalog — accept PRs for new vendors (each PR = a new contributor = a new user)
- "Vendor of the week" campaign — highlight a vendor's status page quirks, get RT'd by their community
- Partner with the Restate community (they'll promote an interesting use case)

**Metric:** 100 active community members, 50 vendor catalog PRs from community

#### 3. Integrations / Partnerships (Middle Ring)

**Why:** StatusPulse becomes more valuable with every integration.

**Priority integrations:**
1. **PagerDuty** — "StatusPulse detected AWS outage → auto-create PagerDuty incident"
2. **Linear/Jira** — "Auto-create ticket when dependency goes down"
3. **Grafana** — StatusPulse as a Grafana data source plugin
4. **Claude Desktop / Cursor / Windsurf** — Pre-built MCP configs for each
5. **Terraform** — Terraform provider for managing StatusPulse config-as-code

**Metric:** 3 integration partnerships, 1 co-marketing announcement

### Supporting Channels (Outer Ring)

| Channel | Tactic |
|---------|--------|
| **SEO** | Target "is [vendor] down" queries with a public dashboard (statuspulse.dev/github) |
| **Developer tools directories** | List on awesome-selfhosted, Product Hunt, AlternativeTo |
| **Conference talks** | Submit to KubeCon, DevOpsDays, local meetups: "Beyond status pages: building an infrastructure health layer" |
| **Viral mechanics** | Public status dashboard with "Powered by StatusPulse" badge. Each public deployment = free advertising |

### Pricing Model (Future)

| Tier | Price | Target |
|------|-------|--------|
| **Community** | Free, self-hosted | Individual devs, small teams |
| **Pro** | $49/mo | Teams needing PostgreSQL, SSO, historical analytics, email alerts |
| **Enterprise** | $299/mo | HA deployment, RBAC, audit logs, SLA, priority support |
| **Cloud** | $99/mo | Managed hosted version (no Docker required) |

### 90-Day Launch Plan

| Week | Milestone |
|------|-----------|
| 1-2 | PostgreSQL support, historical data storage, admin UI for vendor/plugin management |
| 3-4 | Public status dashboard feature (shareable URL), "Powered by StatusPulse" badge |
| 5-6 | PagerDuty + Linear integrations, incident correlation engine |
| 7-8 | Hacker News launch, engineering blog post #1, Product Hunt submission |
| 9-10 | Discord community, vendor catalog PR campaign, Grafana plugin |
| 11-12 | Enterprise features (SSO, RBAC, audit), cloud hosted beta |

### Key Metrics to Track

| Metric | Target (90 days) |
|--------|-------------------|
| GitHub stars | 1,000 |
| Docker pulls | 5,000 |
| Active deployments (telemetry opt-in) | 200 |
| Community members | 100 |
| Vendor catalog PRs | 50 |
| Enterprise leads | 10 |

---

## Part 3: What to Build Next (Priority Stack)

### Immediate (This Sprint)
1. PostgreSQL support (behind `DATABASE_URL` flag)
2. Historical status changes table + uptime percentage API
3. Admin UI: vendor/plugin/alert management from dashboard
4. Search bar in dashboard frontend

### Next Sprint
5. Synthetic HTTP monitoring (ping checks alongside status page polling)
6. Manual status override capability
7. PagerDuty integration
8. Raw response storage + debug view
9. Remove dist-web from git, add CI build step

### Future
10. Public status dashboard (shareable, embeddable)
11. Incident correlation engine
12. SSO/RBAC
13. Grafana data source plugin
14. Cloud hosted offering
