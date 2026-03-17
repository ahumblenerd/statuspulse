.PHONY: install dev mock start stop restart build test test-web test-all lint format typecheck quality clean generate logs kill

# ──────────────────────────────────────────
# Setup
# ──────────────────────────────────────────

install: ## Install all dependencies
	npm install
	cd web && npm install

generate: ## Regenerate frontend SDK from OpenAPI spec
	cd web && npx @hey-api/openapi-ts

# ──────────────────────────────────────────
# Development
# ──────────────────────────────────────────

dev: ## Start backend (hot reload) + frontend dev server
	@make kill-ports 2>/dev/null || true
	npx tsx watch src/index.ts &
	cd web && npx next dev --port 3000 &
	@echo "\n  Frontend: http://localhost:3000"
	@echo "  API:      http://localhost:3001"
	@echo "  MCP:      http://localhost:3002\n"

mock: ## Start in mock mode (no real network calls)
	@make kill-ports 2>/dev/null || true
	MOCK_MODE=true npx tsx watch src/index.ts &
	cd web && npx next dev --port 3000 &
	@echo "\n  Frontend: http://localhost:3000 (mock)"
	@echo "  API:      http://localhost:3001\n"

dev-back: ## Start backend only (hot reload)
	@make kill-ports 2>/dev/null || true
	npx tsx watch src/index.ts

dev-front: ## Start frontend only (Next.js dev server)
	cd web && npx next dev --port 3000

mock-back: ## Start backend only in mock mode
	@make kill-ports 2>/dev/null || true
	MOCK_MODE=true npx tsx watch src/index.ts

# ──────────────────────────────────────────
# Production
# ──────────────────────────────────────────

build: ## Build backend + frontend for production
	npx tsc
	cd web && npx vite build

start: ## Start production server (build first)
	@make kill-ports 2>/dev/null || true
	node dist/index.js

# ──────────────────────────────────────────
# Docker
# ──────────────────────────────────────────

up: ## Start with Docker Compose
	docker compose up -d

down: ## Stop Docker Compose
	docker compose down

rebuild: ## Rebuild and restart Docker
	docker compose up -d --build

# ──────────────────────────────────────────
# Process Management
# ──────────────────────────────────────────

stop: kill-ports ## Stop all StatusPulse processes

restart: stop mock ## Restart in mock mode

restart-dev: stop dev ## Restart in dev mode

kill-ports: ## Kill processes on StatusPulse ports
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3002 | xargs kill -9 2>/dev/null || true
	@lsof -ti:9080 | xargs kill -9 2>/dev/null || true
	@echo "Ports cleared"

# ──────────────────────────────────────────
# Testing
# ──────────────────────────────────────────

test: ## Run backend tests (134 tests)
	npx vitest run

test-web: ## Run frontend tests (19 tests)
	cd web && npx vitest run

test-all: ## Run all tests
	npx vitest run
	cd web && npx vitest run

test-watch: ## Run tests in watch mode
	npx vitest

test-coverage: ## Run tests with coverage report
	npx vitest run --coverage

# ──────────────────────────────────────────
# Code Quality
# ──────────────────────────────────────────

lint: ## Lint backend + frontend
	npx eslint src/
	cd web && npx eslint src/

lint-fix: ## Auto-fix lint issues
	npx eslint src/ --fix
	cd web && npx eslint src/ --fix

format: ## Format all code with Prettier
	npx prettier --write 'src/**/*.ts' 'web/src/**/*.{ts,tsx}'

format-check: ## Check formatting without changes
	npx prettier --check 'src/**/*.ts' 'web/src/**/*.{ts,tsx}'

typecheck: ## TypeScript check (backend + frontend)
	npx tsc --noEmit
	cd web && npx tsc --noEmit

quality: ## Run all quality checks (typecheck + lint + format + tests)
	@make typecheck
	@make lint
	@make format-check
	@make test-all

# ──────────────────────────────────────────
# Mock Scenarios (requires running mock server)
# ──────────────────────────────────────────

scenario-green: ## Set all vendors to operational
	curl -s -X POST http://localhost:3000/api/mock/scenario/all-green | python3 -m json.tool

scenario-outage: ## Trigger GitHub outage scenario
	curl -s -X POST http://localhost:3000/api/mock/scenario/github-outage | python3 -m json.tool

scenario-cascade: ## Trigger cloud cascade scenario
	curl -s -X POST http://localhost:3000/api/mock/scenario/cloud-cascade | python3 -m json.tool

scenario-mixed: ## Trigger mixed reality scenario
	curl -s -X POST http://localhost:3000/api/mock/scenario/mixed-reality | python3 -m json.tool

scenarios: ## List available scenarios
	curl -s http://localhost:3000/api/mock/scenarios | python3 -m json.tool

# ──────────────────────────────────────────
# Utilities
# ──────────────────────────────────────────

status: ## Quick API health check
	@curl -s http://localhost:3000/health | python3 -m json.tool
	@curl -s http://localhost:3000/api/status | python3 -m json.tool

clean: ## Remove build artifacts and data
	rm -rf dist/ dist-web/ data/ coverage/
	@echo "Cleaned build artifacts"

storybook: ## Start Storybook component browser
	cd web && npx storybook dev -p 6006

# ──────────────────────────────────────────
# Help
# ──────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
