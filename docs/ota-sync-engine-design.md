# OTA Sync Engine Design

## Architecture diagram
`Admin UI -> /api/admin staff gate -> otaSyncPlanner -> otaAdapters dry-run payloads -> Supabase OTA tables/views`

Future live sync remains outside Phase 2A.

## Admin UI layer
`public/ota-sync-dry-run.js` renders the OTA Inventory Dry Run panel, date controls, proposed actions, and open conflicts.

## Admin API layer
`api/admin.js` exposes staff-only readiness, mapping, dry-run, and conflict routes.

## Planner layer
`api/otaSyncPlanner.js` validates input, reads channel/mapping/source-of-truth rows, calculates availability proposals, summarizes results, and writes best-effort audit events.

## Adapter layer
`api/otaAdapters.js` returns static metadata and dry-run payloads only. It does not import `fetch`, `axios`, or external SDKs.

## Supabase persistence layer
Phase 1N tables store channels, mappings, sync events, and conflicts. Phase 2A adds indexes, safety comments, and a readiness summary view.

## Future live sync layer
A future phase may add approval-gated writes, but Phase 2A contains only hard-disabled stubs.

## Safety guards
Live mode is rejected in the admin route and adapter layer. `assertLiveSyncDisabled()` throws if live sync is toggled on.

## Live sync disabled guarantee
No OTA credentials, API endpoints, or network calls are present in the adapter layer.

## Channel adapter interface
Adapters expose metadata plus `buildInventoryPayload(channelKey, dryRunItem)` for dry-run-only payload shapes.

## Dry-run payload model
Payloads include channel, accommodation, OTA room/rate IDs, date, availability, reason, proposed action, and `dryRunOnly: true`.

## Event logging model
Dry runs insert compact summary rows into `plp_ota_sync_events`. Full plans are returned to the admin client but not stored wholesale.

## Conflict model
Conflicts have type, severity, channel, accommodation, date range, details, and open review status.

## Failure handling
Missing tables, Supabase errors, or event logging errors are surfaced as warnings when safe. Calculation failures return before any OTA change because no OTA writer exists.
