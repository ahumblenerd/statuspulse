# Vendor Management Expansion — Analysis

## Context

Feedback suggested expanding StatusPulse into broader vendor management: contracts, renewals, security alert scraping, and POC management. This doc captures the analysis and recommendation.

## Feature Assessment

| Feature | Target User | Cadence | Verdict |
|---------|-------------|---------|---------|
| Contract management (terms, pricing, contacts) | Finance, Ops lead | Quarterly | **Skip** — different domain (Vendr, Zylo, Torii territory) |
| Contract renewals (expiry alerts) | Finance, CTO | Annual | **Skip** — calendar/procurement problem, not monitoring |
| Security alert scraping (CVEs, advisories) | Security team, DevSecOps | Weekly | **Build** — same infra, same vendors, same urgency |
| POC setup & management | Eng lead, CTO | Per-evaluation | **Skip** — project management, not monitoring |

## Recommendation: Build Security Advisory Monitor Only

Security alerts are the only expansion that shares StatusPulse's DNA:
- Same source adapter architecture (scrape/poll external sources)
- Same destination adapter architecture (alert to Slack/Teams/webhook)
- Same user (developer who wants to know about vendor health)
- Same urgency profile ("Stripe has a critical CVE" is as urgent as "Stripe is down")

### Positioning shift

**Before:** "StatusPulse tells you when your vendors are broken."
**After:** "StatusPulse tells you when your vendors are broken AND when they're compromised."

Vendor health = operational health + security health.

### Why not contracts/renewals/POC

- Contracts + Renewals → crowded enterprise SaaS spend management market. Completely different data model, different users, different sales motion. A tool that tries to be both ops monitoring and procurement will be mediocre at both.
- POC Management → this is a project tracker. Notion/Linear/spreadsheets already cover this. No reason to build it into a status monitor.

## Security Advisory Monitor — Technical Design

### New Source Adapters

```
github-advisory    → GitHub Advisory Database API (structured, free, per-ecosystem)
nvd-cve            → NIST National Vulnerability Database API
osv                → OSV.dev API (open source vulnerabilities)
vendor-security    → Vendor security pages (scrape, reuse existing scraper infra)
```

### New DB Tables

```sql
security_advisories (
  id              TEXT PRIMARY KEY,
  vendor_id       TEXT REFERENCES services(id),
  cve_id          TEXT,                        -- e.g., CVE-2026-12345
  severity        TEXT NOT NULL,               -- critical, high, medium, low
  title           TEXT NOT NULL,
  description     TEXT,
  published_at    TEXT NOT NULL,
  url             TEXT,
  acknowledged    INTEGER DEFAULT 0,           -- user can dismiss
  created_at      TEXT DEFAULT (datetime('now'))
)

vendor_dependencies (
  id              TEXT PRIMARY KEY,
  vendor_id       TEXT REFERENCES services(id),
  package_name    TEXT,                        -- e.g., "@stripe/stripe-node"
  ecosystem       TEXT,                        -- npm, pypi, go, etc.
  created_at      TEXT DEFAULT (datetime('now'))
)
```

### New Destination Behavior

- Same Slack/Teams/webhook adapters, new event type: `SecurityAdvisoryEvent`
- Severity-based filtering (only alert on critical/high by default)
- Configurable per alert target

### New API Endpoints

```
GET  /api/security                    — list recent advisories across all vendors
GET  /api/security/:vendorId          — advisories for a specific vendor
POST /api/security/:id/acknowledge    — dismiss/acknowledge an advisory
GET  /api/dependencies                — list tracked vendor dependencies
POST /api/dependencies                — add a vendor dependency (package + ecosystem)
```

### New MCP Tools

```
check_vendor_security(vendorId)       — recent advisories for a vendor
search_cves(query)                    — search across all advisories
get_security_overview()               — aggregate security posture
```

### New Frontend Pages

- Security page (list advisories, filter by severity/vendor, acknowledge)
- Vendor detail page addition (security tab showing advisories for that vendor)
- Dashboard addition (security badge showing count of unacknowledged critical/high advisories)

### Estimated Effort

3-4 days of focused work. Reuses existing adapter architecture, alert pipeline, and UI patterns.

## Decision

Parked for later consideration. Will revisit after MVP launch and initial user feedback.
