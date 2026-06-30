# Admin Phase 2D: OTA Room & Rate Mapping Workspace

## Summary
Phase 2D adds an admin-only workspace for reviewing OTA room mappings and OTA rate-plan mappings for Agoda, Airbnb, Expedia, Booking.com, Direct Website, Google Hotel Ads, and Trip.com.

## Admin-only safety boundary
The workspace is available only through staff-protected `/api/admin` actions and the Resort Command admin script chain. It is not a public booking feature.

## Mapping-review-only boundary
Saving an approved mapping means approved for future operator use only. It does not connect to an OTA, push inventory, create bookings, confirm bookings, cancel bookings, mutate payment status, send guest messages, or enable live sync.

## Endpoints added
- `GET /api/admin?action=ota-mapping-workspace`
- `GET /api/admin?action=ota-mapping-summary`
- `POST /api/admin?action=ota-room-mapping`
- `PATCH /api/admin?action=ota-room-mapping`
- `POST /api/admin?action=ota-rate-mapping`
- `PATCH /api/admin?action=ota-rate-mapping`

## Files added
- `api/otaMappingManager.js`
- `public/ota-mapping-workspace.js`
- `supabase/migrations/20260630060000_ota_mapping_workspace.sql`
- Phase 2D docs in `docs/`

## What the mapping workspace does
- Lists room and rate mappings.
- Filters by channel, accommodation, mapping status, and review status.
- Creates draft room and rate mappings.
- Updates mapping and review status.
- Archives incorrect mappings.
- Writes best-effort audit events.

## What it does not do
- No live OTA API calls.
- No credentials or credential placeholders.
- No inventory push.
- No booking creation, confirmation, cancellation, or payment mutation.
- No guest messaging.

## Supported OTA channels
`agoda`, `airbnb`, `expedia`, `booking_com`, `direct_website`, `google_hotel_ads`, `trip_com`, and `unknown`.

## Supported internal accommodations
- Grand Ocean Villa
- Sunset Suite
- Smart Room Premium

## Room mapping fields
Channel, internal accommodation, OTA room ID, OTA room name, OTA property ID, OTA listing ID, OTA channel room code, max guests, mapping status, review status, notes, reviewer, archive fields, update fields, and audit trail.

## Rate plan mapping fields
Channel, internal accommodation, optional room mapping ID, internal rate name, OTA rate plan ID, OTA rate plan name, OTA rate code, currency, min/max nights, refundable policy, meal plan, mapping status, review status, notes, reviewer, archive fields, update fields, and audit trail.

## Review statuses
`needs_review`, `in_review`, `approved`, `rejected`, `archived`.

## Mapping statuses
`draft`, `ready_for_review`, `approved`, `archived`, `blocked`.

## Audit event behavior
Mapping saves attempt to write a row to `plp_ota_mapping_audit_events`. Audit insert failure returns a warning but does not fail the mapping save.

## Deployment gates
- Apply the Phase 2D migration.
- Confirm staff-code protection is configured.
- Run syntax checks, build, viewport check, and route check.
- Verify the admin panel states review-only behavior.

## Rollback plan
- Remove the script loader reference from `public/ota-conflict-console.js`.
- Revert the admin endpoint additions.
- Keep database tables in place unless a database rollback window is explicitly approved.

## Phase 2E handoff
Phase 2E can build a preflight/operator readiness dashboard that reads these mappings and reports readiness gaps without live OTA sync.
