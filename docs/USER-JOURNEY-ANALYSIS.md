# StatusPulse — User Journey Analysis

## Journey A: Current State (As-Is)

**Clicks to aha: ~8 | Time: ~5 min | Satisfaction: Low**

The user adds a vendor on the dashboard, then has to add it *again* on the board. The aha moment (simulation) is buried behind an empty board.

```mermaid
journey
    title Journey A: Current State
    section Boot
      docker compose up: 5: User
      Open dashboard — empty, "All Ok": 3: User
    section Onboarding
      Read onboarding card: 4: User
      Click Add Vendor → search catalog: 3: User
      Add GitHub: 4: User
      Wait for Restate poll: 2: User
    section Board — Broken Path
      Click Default board in sidebar: 4: User
      Board is EMPTY: 1: User
      Confused — just added GitHub: 1: User
      Go to board Services page: 3: User
      Add GitHub AGAIN: 2: User
    section Finally
      See GitHub on board: 4: User
      Scroll to simulation: 3: User
      Click GitHub Outage: 5: User
      AHA — board goes red: 5: User
```

### Problems
1. **Double-add friction** — user adds vendor on dashboard, then must add monitor on board
2. **Empty board kills momentum** — board exists but has nothing on it
3. **Simulation is invisible on empty boards** — scenarios are shown but do nothing
4. **Restate dependency blocks polling** — without it, services never update
5. **Onboarding doesn't connect to boards** — it focuses on adding vendors, not on the board experience

---

## Journey B: Auto-Populated Board (Proposed)

**Clicks to aha: 2 | Time: ~45 sec | Satisfaction: High**

On first boot, auto-create services from the 22 `defaultEnabled` vendors and auto-add them as monitors on the Default board. User opens the app and immediately sees a populated board.

```mermaid
journey
    title Journey B: Auto-Populated — Instant Aha
    section Boot
      docker compose up: 5: User
      Open dashboard — sees 22 services: 5: User
    section Board — Immediate Value
      Click Default board in sidebar: 5: User
      See 22 services all green: 5: User
      See Readiness Drill panel: 5: User
      Click GitHub Outage: 5: User
      Board goes red — AHA: 5: User
      Click End Drill: 5: User
    section Customize
      Remove services they dont use: 4: User
      Add missing services from catalog: 4: User
      Filter Atlassian to Jira only: 5: User
    section Share
      Click Public Page: 5: User
      Copy link to share: 5: User
```

### Evaluation
| Criterion | Score |
|-----------|-------|
| Time to first value | 9/10 — see populated board in <30s |
| Time to aha moment | 10/10 — 2 clicks (sidebar → scenario) |
| Self-explanatory | 8/10 — board with 22 services makes the product obvious |
| Simulation discoverability | 9/10 — panel is visible, services exist to act on |
| Customization path | 7/10 — remove/add/filter is clear |
| Risk | User overwhelmed by 22 services they didn't choose |

---

## Journey C: Guided Setup Wizard (Alternative)

**Clicks to aha: ~5 | Time: ~2 min | Satisfaction: Medium-High**

A step-by-step wizard on first boot: pick your services → name your board → try a drill → share.

```mermaid
journey
    title Journey C: Guided Wizard
    section Boot
      docker compose up: 5: User
      Open dashboard — wizard overlay: 4: User
    section Wizard Step 1
      See "Pick services your team depends on": 4: User
      Check GitHub, AWS, Stripe, Vercel: 5: User
      Click Next: 5: User
    section Wizard Step 2
      Name your board: 4: User
      Click Create: 5: User
    section Wizard Step 3
      See board with 4 services green: 5: User
      Prompted: Try a readiness drill: 5: User
      Click GitHub Outage: 5: User
      AHA — board goes red: 5: User
    section Wizard Step 4
      See public page preview: 5: User
      Copy link: 5: User
      Click Done: 5: User
```

### Evaluation
| Criterion | Score |
|-----------|-------|
| Time to first value | 7/10 — 2 min with wizard |
| Time to aha moment | 7/10 — 5 clicks through wizard |
| Self-explanatory | 9/10 — wizard explains everything |
| Simulation discoverability | 10/10 — wizard forces you to try it |
| Customization path | 9/10 — user chose their own services |
| Risk | Wizard fatigue — users want to explore, not follow steps |

---

## Journey D: Hybrid — Auto-Populate + Contextual Guidance (Recommended)

**Clicks to aha: 2 | Time: ~45 sec | Satisfaction: Highest**

Combine B's instant value with lightweight contextual guidance. No wizard, no steps — just a populated board with smart prompts.

```mermaid
journey
    title Journey D: Hybrid — Auto-Populate + Contextual Guidance
    section Boot
      docker compose up: 5: User
      Open dashboard — 22 services, stats visible: 5: User
    section Board — Instant Value
      Click Default board in sidebar: 5: User
      See 22 services all green: 5: User
      See banner: Ready for a drill? →: 5: User
      Click GitHub Outage scenario: 5: User
      3 monitors go red with simulated badge: 5: User
      Banner changes: Drill active, click End Drill: 5: User
      Click End Drill — all green again: 5: User
    section Customize — Contextual Prompts
      See hint: Remove services you dont need: 4: User
      Delete unused vendors: 5: User
      See hint: Filter to specific products: 4: User
      Expand Atlassian → select Jira only → Save: 5: User
    section Share — Prompted
      See hint: Share your status page: 5: User
      Click Public Page → see clean public view: 5: User
      Click Copy Link: 5: User
    section Advanced
      Create second board for different team: 4: User
      Set up Slack alert on board: 4: User
      Run weekly readiness drill: 5: User
```

### Evaluation
| Criterion | Score |
|-----------|-------|
| Time to first value | 10/10 — populated board at first load |
| Time to aha moment | 10/10 — 2 clicks |
| Self-explanatory | 9/10 — content makes purpose obvious, hints guide next steps |
| Simulation discoverability | 10/10 — banner + panel + services to act on |
| Customization path | 8/10 — subtract (remove unwanted) is easier than add (build from scratch) |
| Risk | Minimal — user starts with too much rather than too little |
| Implementation effort | Low — seed 22 services + board, add 3 contextual hints |

---

## Comparison Matrix

```mermaid
quadrantChart
    title User Journey Comparison
    x-axis Low Implementation Effort --> High Implementation Effort
    y-axis Low User Satisfaction --> High User Satisfaction
    quadrant-1 Best: High Value, Low Effort
    quadrant-2 Good: High Value, High Effort
    quadrant-3 Avoid: Low Value, High Effort
    quadrant-4 Quick Win: Low Value, Low Effort
    Journey A Current: [0.2, 0.25]
    Journey B Auto-Populate: [0.3, 0.8]
    Journey C Wizard: [0.7, 0.75]
    Journey D Hybrid: [0.4, 0.95]
```

| Journey | Clicks to Aha | Time | Effort to Build | User Satisfaction |
|---------|--------------|------|-----------------|-------------------|
| A: Current | 8 | 5 min | Already built | 4/10 |
| B: Auto-Populate | 2 | 45 sec | Low (seed change) | 8/10 |
| C: Guided Wizard | 5 | 2 min | High (new component) | 7/10 |
| **D: Hybrid** | **2** | **45 sec** | **Medium** | **9.5/10** |

---

## Decision: Journey D — Hybrid

Journey D wins because:

1. **Fastest aha** — tied with B at 2 clicks
2. **Highest satisfaction** — auto-populated board + contextual guidance
3. **Subtractive UX** — easier to remove services than to find and add them
4. **No wizard fatigue** — guidance is inline, not blocking
5. **Reasonable effort** — seed logic + 3 contextual hint banners

### Implementation Checklist

1. **Auto-seed services from `defaultEnabled` vendors on first boot** — before creating board monitors
2. **Auto-create board monitors for all seeded services** — already works once services exist
3. **Drill prompt banner on board** — already implemented (DrillPrompt component)
4. **Customization hints** — add subtle text prompts:
   - On board with >15 services: "Tip: Remove services you don't depend on"
   - On a service with >3 components: "Tip: Filter to the products you care about"
   - After first drill ends: "Tip: Share your public status page →"
5. **Remove double-add flow** — adding a vendor on dashboard should also add a monitor on default board

---

## User Flow Diagram — Journey D Final State

```mermaid
flowchart TD
    A[docker compose up] --> B[Open /dashboard]
    B --> C{First boot?}
    C -->|Yes| D[Auto-seed 22 services + Default board with monitors]
    C -->|No| E[Load existing data]
    D --> F[Dashboard: 22 services, stats cards, incidents]
    E --> F

    F --> G[Sidebar: Default board with green dot]
    G --> H[Click Default board]
    H --> I[Board: 22 service cards, all green]

    I --> J[See Readiness Drill banner]
    J --> K[Click GitHub Outage scenario]
    K --> L[3 cards go red, Simulated badges]
    L --> M[Banner: Drill active — End Drill button]
    M --> N[Click End Drill]
    N --> O[All green again — user understands the product]

    O --> P{Customize}
    P --> Q[Remove services they dont use]
    P --> R[Filter Atlassian to Jira only]
    P --> S[Create board for different team]

    O --> T{Share}
    T --> U[Click Public Page button]
    T --> V[Copy link to clipboard]

    O --> W{Alert}
    W --> X[Add Slack webhook to board]
    W --> Y[Run weekly readiness drill]

    style D fill:#d4edda,stroke:#28a745
    style K fill:#fff3cd,stroke:#ffc107
    style L fill:#f8d7da,stroke:#dc3545
    style O fill:#d4edda,stroke:#28a745
```
