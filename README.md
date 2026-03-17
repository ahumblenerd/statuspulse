# StatusPulse

**Dependency status intelligence for engineering teams.**

Monitor your SaaS dependencies, simulate outages, and publish status pages — from one place.

StatusPulse aggregates status from 50+ vendor status pages, lets you curate boards for different teams, and provides readiness drills to practice your incident response before real outages happen.

## Why StatusPulse?

Your team depends on GitHub, AWS, Stripe, Vercel, and dozens of other services. When one goes down, you need to know immediately — and you need to have practiced your response.

- **Boards** — Curate which services each team cares about
- **Readiness Drills** — Simulate outages to test your monitoring and alerting
- **Component Filtering** — Watch only Jira from Atlassian, not all 12 products
- **Public Status Pages** — Share a live status page with your customers
- **Alert Routing** — Slack, Teams, or webhook alerts scoped per board

## Quick Start

```bash
git clone https://github.com/ahumblenerd/statuspulse.git
cd statuspulse
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000). You'll see 22 services already monitored on your Default board.

**Try a readiness drill:** Click "Default" in the sidebar → scroll to "Readiness Drill" → click "GitHub Outage". Watch the board go red.

## Architecture

```
Vendor Status Pages → Pollers → Canonical DB → Projector → Board Monitors
                                                    ↓
                                              Observations
                                                    ↓
                                          Alerts (per board)
```

- **Pollers** fetch from statuspage APIs, RSS feeds, and custom endpoints
- **Projector** computes per-monitor status with component filtering
- **Simulation** sets per-monitor overrides without touching canonical data
- **Public pages** serve curated, board-scoped status

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design.

## Development

```bash
# Install dependencies
npm install && cd web && npm install && cd ..

# Start in mock mode (no real API calls)
make mock

# Run tests (173 tests)
npm test

# Full quality gate
npm run quality
```

### Project Structure

```
src/
  api/routes/        # Hono HTTP routes (boards, monitors, alerts, mock)
  db/                # SQLite schema, queries, seed logic
  ingestion/         # Statuspage API, RSS, scraper, plugin adapters
  restate/           # Poller, alerter, scheduler, projector
  mock/              # Simulation scenarios, board-scoped overrides
  alerts/            # Slack, webhook, Teams destination adapters
  mcp/               # MCP server (7 tools, 2 resources)
web/
  src/app/           # Next.js pages (dashboard, boards, status)
  src/components/    # React components (simulation panel, board switcher)
```

### Key Commands

| Command | Description |
|---------|-------------|
| `make mock` | Start with mock data (MSW intercepts) |
| `make dev` | Start with real polling (needs Restate) |
| `npm test` | Run 173 backend tests |
| `npm run test:web` | Run frontend tests |
| `npm run typecheck` | TypeScript strict mode check |
| `npm run lint` | ESLint (0 errors required) |
| `npm run quality` | All of the above |

### API Highlights

| Endpoint | Description |
|----------|-------------|
| `GET /api/boards` | List boards with status |
| `GET /api/boards/:id` | Board detail with monitors |
| `POST /api/boards` | Create board |
| `GET /api/boards/:slug/public` | Public status page data |
| `POST /api/mock/boards/:id/scenarios/:name` | Apply simulation scenario |
| `POST /api/mock/monitors/:id/status` | Override single monitor |
| `POST /api/mock/boards/:id/reset` | End drill |

Full API spec: `GET /api/openapi.json`

### Simulation API

```bash
# Apply a scenario to a board
curl -X POST http://localhost:3000/api/mock/boards/{boardId}/scenarios/github-outage

# Override a single monitor
curl -X POST http://localhost:3000/api/mock/monitors/{monitorId}/status \
  -H 'Content-Type: application/json' -d '{"status":"outage"}'

# End drill (reset all overrides)
curl -X POST http://localhost:3000/api/mock/boards/{boardId}/reset

# Seed 30 days of history
curl -X POST http://localhost:3000/api/mock/seed-history \
  -H 'Content-Type: application/json' -d '{"boardId":"{boardId}"}'
```

## Stack

- **Backend:** Node.js, Hono, SQLite (Drizzle ORM), Restate (durable execution)
- **Frontend:** Next.js, shadcn/ui, Tanstack Query
- **Testing:** Vitest, MSW (173 backend + 19 frontend tests)
- **MCP:** Streamable HTTP transport for AI assistant integration

## License

MIT
