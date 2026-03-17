# Architectural Improvement Plan

## Overview

This document outlines opportunities to improve code quality through standard architectural patterns, replacing scattered if-else logic with cleaner abstractions.

## Current State Assessment

### Patterns Already Well-Implemented ✓

| Pattern  | Location                                              | Implementation                                    |
| -------- | ----------------------------------------------------- | ------------------------------------------------- |
| Registry | `src/ingestion/registry.ts`, `src/alerts/registry.ts` | Map-based adapter registration                    |
| Adapter  | `src/lib/adapters.ts`                                 | `SourceAdapter` / `DestinationAdapter` interfaces |
| Factory  | `src/vendors/registry.ts`                             | Lazy JSON catalog loading                         |

---

## Priority 1: High-Impact Refactors

### 1.1 Webhook Handler Dispatch (`src/ingestion/webhook-receiver.ts`)

**Current Problem:**

```typescript
// Lines 68-102: if-else chain for payload type detection
if (body.component_update) { ... }
else if (body.incident) { ... }
else { ... }  // generic fallback
```

**Issues:**

- Not extensible for new webhook formats
- Hard to test individual handlers
- Type discrimination happens at runtime via property checks

**Proposed Pattern: Handler Map with Type Guards**

```typescript
// New file: src/ingestion/webhook-handlers.ts

interface WebhookHandler {
  canHandle: (body: unknown) => boolean;
  handle: (body: unknown, vendorId: string) => Promise<WebhookResult>;
}

const handlers: WebhookHandler[] = [
  componentUpdateHandler,
  incidentHandler,
  genericHandler, // fallback
];

export function detectAndHandle(body: unknown, vendorId: string): Promise<WebhookResult> {
  const handler = handlers.find((h) => h.canHandle(body));
  if (!handler) throw new Error("No handler found");
  return handler.handle(body, vendorId);
}
```

**Benefits:**

- O(1) lookup instead of sequential checks
- Easy to add new handlers without modifying existing code
- Each handler is independently testable

---

### 1.2 Selection Mode Strategy (`src/db/observation-queries.ts`)

**Current Problem:**

```typescript
// Lines 84-89: if-else for component filtering
if (monitor.selectionMode === "include_only" && selected) {
  filtered = comps.filter((c) => selected.includes(c.id));
} else if (monitor.selectionMode === "exclude" && selected) {
  filtered = comps.filter((c) => !selected.includes(c.id));
}
```

**Proposed Pattern: Strategy Map**

```typescript
// Add to observation-queries.ts

type SelectionStrategy = (components: Component[], selected: string[]) => Component[];

const selectionStrategies: Record<string, SelectionStrategy> = {
  include_only: (comps, selected) => comps.filter((c) => selected.includes(c.id)),
  exclude: (comps, selected) => comps.filter((c) => !selected.includes(c.id)),
  all: (comps) => comps,
};

export function computeMonitorStatus(monitor: MonitorConfig): NormalizedStatusType {
  // ... existing logic ...
  const filter = selectionStrategies[monitor.selectionMode] ?? selectionStrategies.all;
  const filtered = filter(comps, selected ?? []);
  // ...
}
```

---

### 1.3 Unified Poller Logic (`src/restate/poller.ts`)

**Current Problem:**

- Duplicate code paths for vendor polling (lines 28-97) and plugin polling (lines 106-149)
- Both follow: fetch → persist → project → alert

**Proposed Pattern: Pipeline with Middleware**

```typescript
// New file: src/lib/pipeline.ts

interface PollContext {
  vendorId: string;
  vendorName: string;
  sourceType: string;
  url: string;
  config?: Record<string, unknown>;
}

type PollMiddleware = (ctx: PollContext, next: () => Promise<void>) => Promise<void>;

const pollPipeline: PollMiddleware[] = [
  fetchMiddleware,
  persistStatusMiddleware,
  projectToMonitorsMiddleware,
  alertMiddleware,
];

export async function runPollPipeline(ctx: PollContext): Promise<void> {
  let index = 0;
  const next = async (): Promise<void> => {
    if (index >= pollPipeline.length) return;
    const middleware = pollPipeline[index++];
    await middleware(ctx, next);
  };
  await next();
}
```

**Benefits:**

- Single processing path for all pollable sources
- Easy to add cross-cutting concerns (logging, metrics, retries)
- Plugins and vendors become implementation details

---

## Priority 2: Consolidate Duplication

### 2.1 Duplicate `worstStatus` Logic

**Locations:**

- `src/lib/normalize.ts:46-57` — returns `NormalizedStatusType`
- `src/db/observation-queries.ts:38-50` — returns `string`

**Fix:** Single implementation in `lib/normalize.ts`, import everywhere:

```typescript
// src/lib/normalize.ts
export function worstStatus<T extends string>(statuses: T[]): T {
  const priority: Record<string, number> = {
    operational: 0,
    maintenance: 1,
    degraded: 2,
    outage: 3,
  };
  return statuses.reduce((worst, s) =>
    (priority[s] ?? 0) > (priority[worst] ?? 0) ? s : worst
  ) as T;
}
```

---

### 2.2 Duplicate Alert Target Types

**Current:** Hardcoded in `src/lib/types.ts:64`

```typescript
type: "slack" | "webhook"; // also "teams" in alerts/registry.ts
```

**Fix:** Single enum shared across modules:

```typescript
// src/lib/types.ts
export const AlertTargetType = {
  Slack: "slack",
  Webhook: "webhook",
  Teams: "teams",
} as const;

export type AlertTargetType = (typeof AlertTargetType)[keyof typeof AlertTargetType];
```

---

## Priority 3: Polish & Enforce

### 3.1 Extract Configuration Schema

Move hardcoded values to config:

| Currently                   | Should Be                                           |
| --------------------------- | --------------------------------------------------- |
| `defaultEnabled` in catalog | `DEFAULT_ENABLED: boolean` in config                |
| Poll interval fallback      | `DEFAULT_POLL_INTERVAL_SECONDS` already in config ✓ |

### 3.2 Add TypeScript Discriminated Unions

Instead of:

```typescript
interface ServiceStatus {
  status: NormalizedStatusType;
  // ...
}
```

Use:

```typescript
type ServiceStatus =
  | { status: "operational" }
  | { status: "degraded"; affectedComponents: string[] }
  | { status: "outage"; duration?: number }
  | { status: "maintenance"; scheduledUntil?: string };
```

---

## Implementation Order

1. **Phase 1** (Quick Wins)
   - [ ] Consolidate `worstStatus` to single source
   - [ ] Extract AlertTargetType enum

2. **Phase 2** (Core Refactor)
   - [ ] Implement webhook handler map
   - [ ] Refactor selection mode to strategy map

3. **Phase 3** (Advanced)
   - [ ] Unify poller pipeline
   - [ ] Add discriminated unions for status types

---

## Clean Code Assessment

_Assessed through Uncle Bob's Clean Code principles_

### The Good ✓

#### 1. Registry Pattern is Clean

`src/ingestion/registry.ts` — single responsibility, Map-based, extensible:

```typescript
const sourceRegistry = new Map<string, SourceAdapter>();
export function getSourceAdapter(type: string): SourceAdapter | undefined {
  return sourceRegistry.get(type);
}
```

#### 2. Adapter Interfaces are Well-Defined

`src/lib/adapters.ts` — small, focused interfaces:

```typescript
interface SourceAdapter {
  readonly type: string;
  fetch(url: string, vendorId: string, config?: Record<string, unknown>): Promise<IngestionResult>;
}
```

#### 3. Function Names Reveal Intent

- `persistStatus()` — does what it says
- `projectServiceUpdate()` — clear purpose
- `computeMonitorStatus()` — no ambiguity

#### 4. Normalization Centralized

`src/lib/normalize.ts` — single source of truth for status mapping

---

### The Bad ⚠️

#### 1. Magic Strings Everywhere

`src/lib/types.ts:64`:

```typescript
type: "slack" | "webhook"; // used in multiple places
```

Should be: `const AlertTargetType = { Slack: "slack", Webhook: "webhook" } as const`

#### 2. Duplicated `worstStatus` Logic

`src/lib/normalize.ts:46-57` AND `src/db/observation-queries.ts:38-50` — both implement the same priority ranking

#### 3. Function Doing Too Much

`src/restate/poller.ts:28-97` — `poll` handler does: fetch → persist → probe → alert → project

#### 4. Error Swallowing

`src/ingestion/webhook-receiver.ts:41-43`:

```typescript
try {
  await fetch(...);
} catch {  // empty catch!
  console.warn(`[webhook] Failed to fire alert for ${vendorId}`);
}
```

---

### The Ugly 😬

#### 1. If-Else Chains (Clean Code enemy #1)

`src/ingestion/webhook-receiver.ts:68-102`:

```typescript
if (body.component_update) { ... }
else if (body.incident) { ... }
else { ... }
```

#### 2. Type Coercion Everywhere

`src/db/observation-queries.ts:55`:

```typescript
return (svc?.status as NormalizedStatusType) ?? "operational";
```

Implicit `as` casts bypass TypeScript's safety.

#### 3. God Object Parameters

`src/restate/poller.ts:106-149` — `pollPlugin` has too many responsibilities

#### 4. Hardcoded Config in Code

`src/db/seed.ts` — poll interval logic embedded in seed function

#### 5. No Error Boundaries

`src/api/helpers/status-aggregator.ts:18-22` — no try/catch, fails silently if DB has issues

---

### What to Change (Clean Code Verdict)

| Priority | Change                                    | Why                            |
| -------- | ----------------------------------------- | ------------------------------ |
| **1**    | Extract webhook handlers to separate file | Single Responsibility          |
| **2**    | Unify `worstStatus`                       | DRY principle                  |
| **3**    | Add `AlertTargetType` enum                | Magic strings are evil         |
| **4**    | Split `poll` into smaller functions       | Functions should be < 20 lines |
| **5**    | Fix empty catch blocks                    | Never swallow errors silently  |

---

## Trade-offs to Consider

| Decision                   | Pro                                | Con                            |
| -------------------------- | ---------------------------------- | ------------------------------ |
| Handler Map for webhooks   | Extensible, testable               | Slight indirection             |
| Strategy Map for selection | Clean, add new modes easily        | Overkill if modes never expand |
| Pipeline for polling       | Centralized logic, easy middleware | More abstraction to learn      |
