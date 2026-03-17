# StatusGator Research and Architecture Implications

Date: 2026-03-17

## Executive summary

StatusGator is not modeled as "a flat list of vendors." It is modeled as:

1. A large service directory
2. A set of boards
3. A set of monitors attached to each board
4. Per-monitor filtering, notification, and visibility rules
5. Per-board status pages, embeds, and integrations

That distinction matters.

Your current StatusPulse model is still too vendor-centric:

- vendors are defined in a static catalog
- polling is keyed by `vendorId`
- mock mode is mostly vendor-level
- there is no first-class `board`
- status-page visibility is not separated from monitoring

That model will not scale to vendors like Atlassian, AWS, Salesforce, Microsoft, or Google where one vendor contains many products, components, instances, and regions.

The right re-architecture is:

1. Keep a global vendor/service directory
2. Introduce first-class boards
3. Introduce first-class monitors on boards
4. Separate canonical provider data from user-selected monitored slices
5. Make mock mode operate at the same level as real monitoring: board + monitor + selected components
6. Treat screens/TV displays as a board presentation mode, not a separate monitoring primitive

## What StatusGator actually does

### 1. Boards are the primary container

StatusGator supports multiple boards. Each board has its own:

- monitors
- integrations
- notification routing
- status page

It explicitly documents that additional boards are used for different teams, departments, or environments, and that duplicating boards is useful for staging, QA, or regional setups.

Implication for StatusPulse:

- a board is not just a saved filter
- a board is the product boundary for who sees what, who gets alerts, and what gets published

### 2. A vendor is not the unit users actually monitor

StatusGator exposes a service directory, then lets users add a service monitor to a board. After that, the user configures:

- display name
- description/icon
- component filters
- incident types to notify on
- Early Warning Signal behavior

For large vendors, the important capability is component filtering. StatusGator explicitly calls out services such as AWS and Salesforce with huge component lists and tells users to search by product or region such as `S3`, `N. Virginia`, or `EU West`.

Implication for StatusPulse:

- "Atlassian" is not enough
- the monitored subject is often a subset of a vendor's component tree
- one customer may want only `Jira Software` and `Confluence`
- another may want only `Jira API` in a certain region

### 3. StatusGator supports monitor types, not just vendor status pages

StatusGator's monitoring model includes:

- service monitors for official third-party status pages
- services without official status pages via their detection algorithm
- website monitors
- ping monitors
- custom monitors for manual incidents/maintenance
- private status integrations for internal service health

Implication for StatusPulse:

- the core product primitive should be `monitor`
- adapters feed monitors, rather than the product being defined only by a vendor catalog row

### 4. Notifications are board-scoped and monitor-scoped

StatusGator supports global board notification settings and also per-monitor notification configuration. It supports multiple channels, and explicitly uses boards to route different monitors to different Slack channels.

Implication for StatusPulse:

- alert routing belongs on boards and board monitors
- alert policies need inheritance:
  - org default
  - board default
  - monitor override

### 5. Status pages, embeds, and TV displays are presentation layers on top of boards

StatusGator supports:

- public/private status pages
- password protection and SAML options
- custom domain and hosted subdomain
- iFrame embed
- compact status embed
- modal embed
- TV integration

It also supports hiding a monitor from the published status page while still monitoring and alerting on it.

Implication for StatusPulse:

- board monitoring and board presentation must be separate concerns
- a screen/TV view should derive from a board or board view
- publication rules should be separate from monitor existence

### 6. Early Warning Signals are a first-class status source

StatusGator treats Early Warning Signals as a real signal path, visible on the board and on the status page, with global or monitor-level enable/disable behavior.

Implication for StatusPulse:

- future crowd/external-signal inputs should be modeled as observations against a monitored subject, not as a special-case vendor flag

## Current StatusPulse gap

Based on the current codebase:

- vendor definitions come from a static catalog in [`src/vendors/registry.ts`](/Users/ahd-clawd/Desktop/work/statuspulse/src/vendors/registry.ts)
- polling is keyed by vendor in [`src/restate/poller.ts`](/Users/ahd-clawd/Desktop/work/statuspulse/src/restate/poller.ts)
- persisted rows in [`src/db/client.ts`](/Users/ahd-clawd/Desktop/work/statuspulse/src/db/client.ts) use `services`, `components`, and `incidents`, but there is no first-class `boards` model
- mock mode exists, but the current API shape is mostly scenario-level and vendor-level, documented in [`README.md`](/Users/ahd-clawd/Desktop/work/statuspulse/README.md)

This creates four structural problems:

### Problem 1. Vendor identity is overloaded

`vendorId` currently represents too many things at once:

- directory entry
- poller key
- top-level monitored service
- identity for incidents/components

That breaks down when one vendor has many independently meaningful products or product-region combinations.

### Problem 2. Canonical provider data and customer-specific selection are mixed

You need two separate things:

- canonical source data: what Atlassian publishes
- customer monitor config: which subset this board cares about

Right now the product leans too hard on the canonical vendor row and not enough on the customer monitor row.

### Problem 3. Mock mode is not universal

The repo already identifies this issue in [`docs/GTM-STRATEGY.md`](/Users/ahd-clawd/Desktop/work/statuspulse/docs/GTM-STRATEGY.md): mock coverage is incomplete across ingestion types and the current per-vendor override only changes top-level status well.

If mock mode is a product feature, every monitor type has to support:

- healthy state
- degraded state
- outage state
- maintenance state
- incident timeline
- component-level impact
- regional impact

### Problem 4. Boards/screens do not exist as first-class entities

Without first-class boards, you cannot cleanly support:

- different teams tracking different subsets
- separate notification policies
- internal vs external status publication
- screen-specific layouts
- one organization having multiple operational contexts

## Proposed target model

### Conceptual model

Use this hierarchy:

```text
Organization
  -> Board
    -> BoardMonitor
      -> MonitorSubject
        -> ProviderService
          -> ProviderComponent
            -> ProviderRegion
```

Where:

- `ProviderService` is the canonical thing from your directory, such as Atlassian
- `ProviderComponent` is the canonical component/product/instance/region node from the source, such as Jira Software, Bitbucket Pipelines, or US region components
- `MonitorSubject` is the resolved subset a user wants to watch
- `BoardMonitor` is the user-owned monitor config attached to a board

The critical distinction is:

- provider data is global and reusable
- monitors are local and opinionated

### Minimum schema direction

Add first-class tables roughly like this:

```sql
organizations (
  id,
  name
)

boards (
  id,
  organization_id,
  name,
  description,
  timezone,
  is_default
)

board_views (
  id,
  board_id,
  name,
  type,              -- dashboard, status_page, tv, embed
  visibility,        -- internal, public, password, sso
  layout_config_json,
  theme_config_json
)

provider_services (
  id,
  vendor_key,        -- stable catalog key
  name,
  category,
  homepage_url,
  status_page_url,
  source_type
)

provider_components (
  id,
  provider_service_id,
  external_id,
  parent_component_id,
  name,
  component_type,    -- product, component, instance, region, group
  region_key,
  metadata_json
)

board_monitors (
  id,
  board_id,
  monitor_type,      -- provider_service, website, ping, custom, plugin
  name,
  description,
  icon_url,
  enabled,
  notification_policy_json,
  display_policy_json
)

board_monitor_subjects (
  id,
  board_monitor_id,
  provider_service_id,
  selection_mode,    -- all, include_only, exclude
  selected_component_ids_json,
  selected_region_keys_json
)

observations (
  id,
  board_monitor_id,
  source,            -- official, early-warning, mock, manual, probe
  scope_type,        -- monitor, component, region
  scope_ref,
  status,
  observed_at,
  payload_json
)

incidents (
  id,
  board_monitor_id,
  source_incident_id,
  title,
  status,
  impact,
  started_at,
  updated_at,
  resolved_at,
  payload_json
)

incident_impacts (
  id,
  incident_id,
  provider_component_id,
  region_key,
  status
)
```

This is not the final schema, but it fixes the right boundary:

- canonical provider directory data
- board-owned monitor configuration
- observations and incidents attached to the selected monitor context

## How Atlassian should work in the new model

Today you effectively think in terms of:

- vendor: `atlassian`

You need to support:

- provider service: `Atlassian`
- canonical components:
  - `Jira Software`
  - `Jira Work Management`
  - `Confluence`
  - `Bitbucket`
  - `Opsgenie`
  - `Statuspage`
  - region or shard subcomponents if published

Then a board can create multiple monitors from the same provider:

1. `Atlassian - Customer facing`
   selection: `Jira Software`, `Confluence`
2. `Atlassian - Engineering`
   selection: `Bitbucket`, `Opsgenie`, `Statuspage`
3. `Atlassian - EU footprint`
   selection: components tagged with EU regions only

That is much closer to how StatusGator behaves when it lets users search/filter specific components, then rename the resulting monitor to the thing they actually care about.

## Mock mode should be re-architected as a monitor source

Mock mode should not be a side API that mutates vendor status in an ad hoc way.

It should be one source of observations in the same pipeline as real data.

### Target behavior

Every `board_monitor` should support:

- `source = official`
- `source = early-warning`
- `source = probe`
- `source = manual`
- `source = mock`

Then mock scenarios operate on monitors or selected components, not raw vendors.

### Required mock capabilities

For every supported monitor type:

- provider service monitor
- website monitor
- ping monitor
- custom/manual monitor
- plugin/custom adapter monitor

Support these actions:

- set monitor status
- set component statuses
- set regional statuses
- create/update/resolve incidents
- trigger maintenance windows
- advance timeline for demos

### Example mock API shape

```http
POST /api/mock/boards/:boardId/scenarios/:scenarioId/activate
POST /api/mock/monitors/:monitorId/status
POST /api/mock/monitors/:monitorId/incidents
POST /api/mock/monitors/:monitorId/components/:componentId/status
POST /api/mock/monitors/:monitorId/reset
```

This gives you deterministic demos for boards, not just deterministic demos for vendors.

## Boards and screens

Your proposed "boards" feature is correct, but it should be defined precisely:

- a `board` is the operational container
- a `screen` is a presentation of a board

Do not make screens the top-level entity.

### Recommended model

```text
Board
  -> default dashboard view
  -> public/private status page view
  -> TV/screen view
  -> embed views
```

### Screen requirements

Each screen should support:

- board selection
- optional saved view or layout preset
- auto-refresh
- compact/expanded density
- incident expansion rules
- theme/branding
- auth or public token

This is very close to StatusGator's TV integration, which is just a large-screen rendering of the monitored board.

## Product recommendations

### Build now

1. First-class boards
2. Board-specific monitors
3. Component/product/region selection per monitor
4. Universal mock mode at monitor scope
5. Screen/TV views derived from boards
6. Separate publication visibility from monitoring

### Build soon after

1. Board duplication
2. Per-board integrations and notification defaults
3. Public/private status page variants
4. Embeds: iframe, compact widget, modal, TV
5. Per-board hidden monitors

### Build later

1. Private status ingestion
2. Early-warning / crowd signal model
3. Status page push integrations like Statuspage / StatusHub
4. Reliability history and exports

## Recommended implementation order

### Phase 1. Data model split

Introduce:

- `boards`
- `board_monitors`
- `provider_services`
- `provider_components`

Keep the existing vendor catalog as seed data for `provider_services`.

### Phase 2. Polling and persistence split

Refactor pollers so they:

1. fetch canonical provider state
2. persist canonical provider/component snapshots
3. project those snapshots into board monitor state based on component filters

This is the highest-value architectural change.

### Phase 3. Mock engine rewrite

Make mock data emit observations into the same projection pipeline as real polling.

If that is done correctly, "all vendors support mock mode" becomes a property of the architecture, not a manual compatibility checklist.

### Phase 4. Board UX

Add:

- board CRUD
- board duplication
- monitor add flow from directory
- component/product/region filter UI
- board-level notification settings

### Phase 5. Board presentation

Add:

- public/private status page per board
- TV/screen view per board
- embed variants

## Bottom line

The product should stop thinking in terms of "we monitor vendors" and start thinking in terms of:

"we let each board monitor the exact slices of vendor and internal service health that matter to that audience."

That is the core move StatusGator has made.

If you adopt that model:

- Atlassian with many products/regions stops being a schema problem
- mock mode becomes universal
- boards become natural
- screens become a board view, not a separate subsystem

## Sources

- StatusGator homepage: https://statusgator.com/
- Quick start guide: https://support.statusgator.com/support/solutions/articles/47001280711-quick-start-guide
- What StatusGator is and how it works: https://support.statusgator.com/support/solutions/articles/47001280710-what-statusgator-is-and-how-it-works
- Create additional boards: https://support.statusgator.com/support/solutions/articles/47001208764-create-additional-boards
- Add a service monitor: https://support.statusgator.com/support/solutions/articles/47001280761-add-a-service-monitor
- Configure a service monitor: https://support.statusgator.com/support/solutions/articles/47001280763-configure-a-service-monitor
- Filter service components: https://support.statusgator.com/support/solutions/articles/47001208752-filter-service-components
- Searching for service components: https://support.statusgator.com/support/solutions/articles/47001255514-searching-for-service-components
- Use the service directory: https://support.statusgator.com/support/solutions/articles/47001262933-use-the-service-directory
- Early Warning Signals: https://support.statusgator.com/support/solutions/articles/47001263083-early-warning-signals
- Global notifications: https://support.statusgator.com/support/solutions/articles/47001264871-global-notifications
- Send alerts to different Slack channels: https://support.statusgator.com/support/solutions/articles/47001247101-send-alerts-to-different-slack-channels
- Add a custom monitor: https://support.statusgator.com/support/solutions/articles/47001261529-add-a-custom-monitor
- Add a website monitor: https://support.statusgator.com/support/solutions/articles/47001177823-monitoring-your-own-website
- Configure a website monitor: https://support.statusgator.com/support/solutions/articles/47001280824-configure-a-website-monitor
- Monitor website content: https://support.statusgator.com/support/solutions/articles/47001257005-monitor-website-content
- Add a ping monitor: https://support.statusgator.com/support/solutions/articles/47001266950-add-a-ping-monitor
- StatusGator monitoring regions: https://support.statusgator.com/support/solutions/articles/47001268351-statusgator-monitoring-regions
- Private status integrations: https://support.statusgator.com/support/solutions/articles/47001258830-private-status-ingestion
- Iframe embed: https://support.statusgator.com/support/solutions/articles/47001202651-iframe-embed
- TV integration: https://support.statusgator.com/support/solutions/articles/47001237185-tv-integration
- Hide monitors on your status page: https://support.statusgator.com/support/solutions/articles/47001261033-hide-monitors-on-your-status-page
- Enable password protection on a status page: https://support.statusgator.com/support/solutions/articles/47001217668-protecting-your-status-page-with-a-password
- Host your status page on a custom domain: https://support.statusgator.com/support/solutions/articles/47001189394-hosting-your-status-page-on-a-custom-domain
- Connect StatusGator with webhooks: https://support.statusgator.com/support/solutions/articles/47001226973-integrating-statusgator-with-webhooks
