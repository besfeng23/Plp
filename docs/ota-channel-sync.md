# OTA Channel Sync Foundation

Phase 2A adds planning and UI foundation for future OTA/channel-manager integrations. It does **not** connect to live OTA APIs, scrape OTA sites, store real credentials, or change booking/payment verification semantics.

## Architecture

The future channel sync system should be layered so each boundary is reviewable:

1. **Channel registry**: supported source definitions for Booking.com, Agoda, Airbnb, Expedia, Vrbo, direct website bookings, and manual admin bookings.
2. **Connection records**: non-secret connection metadata and references to server-side credential storage. Plaintext credentials must never be placed in client code, docs, or JSON payload snapshots.
3. **Room and rate mapping**: channel-specific room/rate identifiers mapped to PLP accommodation records only after staff review.
4. **External booking imports**: imported reservations staged in a review queue before they affect operational availability.
5. **Availability blocks**: inventory blocks created from mapped external bookings or iCal events after validation.
6. **Conflict detection**: overlap, duplicate, stale mapping, cancellation mismatch, and modified-stay checks routed to staff review.
7. **Sync logs**: immutable-ish run/event logs for import/export attempts, payload summaries, and errors.
8. **Admin review UI**: Resort Command foundation screens that explain the current placeholder state and future workflow.

## Supported future channels

The shared constants in `lib/ota/channels.js` define the initial channel keys:

- `booking_com`
- `agoda`
- `airbnb`
- `expedia`
- `vrbo`
- `direct`
- `manual`

`direct` represents PLP website bookings already created through controlled booking flows. `manual` represents staff-created reservations in Resort Command once a persisted manual-booking workflow exists.

## iCal phase

The safest first integration phase should be iCal import/export because it can block availability without requiring full partner API credentials.

Recommended iCal rules:

- Treat incoming iCal events as **availability blocks**, not confirmed direct bookings.
- Keep original event data in `raw_payload` for audit while avoiding secrets.
- Require room mapping before a feed can block a specific PLP accommodation.
- Mark unmapped events as `needs_review`.
- Detect overlaps against existing PLP bookings and existing availability blocks.
- Log every feed run in `calendar_sync_runs`.
- Never infer payment status from iCal data.

## Direct API phase

Direct OTA API connections should come after the iCal workflow is stable.

Recommended API rules:

- Use server-side integrations only; no client-side credentials.
- Store only a credential reference in database rows, not the secret itself.
- Import bookings into `external_bookings` first.
- Create or update operational blocks only after mapping and conflict checks.
- Record provider payload snapshots in JSONB with PII minimized where possible.
- Preserve cancellation and modification events as `external_booking_events`.
- Do not change PLP booking/payment statuses based solely on external source data.

## Channel manager option

A channel manager may become preferable if PLP wants one integration surface instead of separate Booking.com, Agoda, Airbnb, Expedia, and Vrbo integrations.

If adopted, the channel manager should still feed the same internal model:

- `ota_channels` can include a `channel_manager` type.
- `ota_channel_connections` can identify the manager account and non-secret credential reference.
- Imported reservations still land in `external_bookings`.
- Room/rate mappings still require review.
- Conflicts still route to `availability_conflicts`.

## Conflict handling rules

Future conflict detection should flag at least:

- External stay overlaps an existing PLP confirmed or held booking.
- External stay overlaps another external availability block.
- External booking uses an unmapped room or stale room mapping.
- External cancellation conflicts with a still-blocked local date range.
- Modified external dates widen into occupied inventory.
- Duplicate external booking IDs arrive from repeat sync runs.

Conflict resolution should be explicit and staff-reviewed. Do not auto-confirm, auto-cancel, or alter payment state from channel sync events.

## Data safety rules

- No live OTA credentials in source control.
- No plaintext credentials in database fields or `raw_payload`.
- No Booking.com, Agoda, Expedia, Airbnb, or Vrbo scraping.
- No client-side credential fields.
- No changes to Xendit webhook logic.
- No changes to payment verification meaning.
- No automatic promotion of external imports to confirmed PLP bookings without staff review.
- Raw payloads should support audit/debugging but avoid unnecessary sensitive guest data.

## Implemented now in Phase 2A

- Shared channel/status constants in `lib/ota/channels.js`.
- A documented schema foundation in `docs/database/ota-channel-sync-schema.md` because this repo does not have an established migrations directory.
- Resort Command placeholder screens for:
  - Channels
  - External Bookings
  - Calendar Sync
  - Conflicts
  - Room Mapping
  - Sync Logs
- Clear admin messaging that live OTA API credentials are not connected yet.

## Future work

Recommended next tasks:

1. Convert the documented schema into a reviewed Supabase migration after confirming production table names, RLS posture, and foreign keys.
2. Add read-only admin API endpoints for empty/future OTA tables once the migration exists.
3. Implement iCal parser/import dry-runs with fixture tests and no live feed credentials.
4. Add staff-reviewed room mapping persistence.
5. Add conflict-detection dry-run logic before any availability block writes.
6. Evaluate whether direct OTA APIs or a channel manager should be the long-term integration path.
