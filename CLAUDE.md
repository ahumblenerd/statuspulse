# StatusPulse — Project Conventions

## Code Quality Standards

### File Length
- **Max 200 lines per source file** (enforced by ESLint `max-lines` rule)
- Test and mock files are exempt
- If a file grows past 150 lines, consider splitting proactively

### Testing (TDD)
- **Write tests first** when adding new features
- Tests live in `src/test/` mirroring `src/` structure
- Use `createTestDb()` from `src/test/db.ts` for in-memory SQLite
- Use MSW handlers from `src/test/msw/handlers.ts` for HTTP mocking
- Run `npm test` before every commit (enforced by pre-commit hook)

### Imports
- Use `type` imports for types: `import type { Foo } from "./foo.js"`
- Import order enforced by ESLint: builtin → external → internal → parent → sibling
- Always use `.js` extensions in imports (ESM requirement)

### TypeScript
- Strict mode enabled
- Avoid `any` — use `unknown` and narrow, or define proper types
- All exported functions should have JSDoc descriptions

### Architecture Rules
- **Ingestion modules** (`src/ingestion/`) must not import from `db/` — they return data, callers persist
- **Alert modules** (`src/alerts/`) must not import from `db/` — they receive events, callers load targets
- **Restate handlers** (`src/restate/`) are the orchestration layer — they wire ingestion → persistence → alerts
- **API routes** read from `db` directly (via the proxy singleton)
- **Persistence logic** lives in `src/db/queries.ts` — keep route handlers thin

### Normalized Status
Only 4 statuses exist: `operational`, `degraded`, `outage`, `maintenance`
All external statuses must be mapped through `src/lib/normalize.ts`

### Adding a Vendor
1. Add entry to `src/vendors/catalog.json`
2. No code changes needed if vendor uses `statuspage-api`, `rss`, `atom`, or `scrape` ingestion type
3. Run tests to verify

### Adding a Plugin (Bespoke Status Page)
```bash
curl -X POST http://localhost:3000/api/plugins -H 'Content-Type: application/json' -d '{
  "id": "my-api",
  "name": "My Internal API",
  "type": "custom-api",
  "config": {
    "url": "https://my-api.internal/health",
    "statusPath": "status.overall",
    "statusMapping": { "healthy": "operational", "unhealthy": "outage" }
  }
}'
```

## Commands
```bash
npm test              # Backend tests (121 tests)
npm run test:web      # Frontend tests (19 tests)
npm run test:all      # Both
npm run test:coverage # With V8 coverage
npm run lint          # ESLint (0 errors required)
npm run format        # Prettier
npm run typecheck     # TypeScript strict mode
npm run quality       # All of the above
npm run dev:mock      # Start with mock data (MOCK_MODE=true)
cd web && npm run storybook  # Component stories
```

## Pre-commit Hook
The hook runs: lint-staged → typecheck → backend tests → frontend tests → file length check → inline CSS check → quality reminder message.
All steps must pass for the commit to proceed.

### CSS Rules
- **No inline CSS** (`style={{}}`) in app code — shadcn/ui components in `web/src/components/ui/` are exempt
- All styling via Tailwind utility classes or CSS variables defined in `web/src/app/globals.css`
- Pre-commit hook enforces this automatically
