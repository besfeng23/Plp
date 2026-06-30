# Admin Phase 2A — OTA Inventory Sync Foundation Dry Run

## Summary
Phase 2A adds an admin-only OTA inventory dry-run planner. It answers what Resort Command would send to Agoda, Airbnb, Expedia, Booking.com, Direct Website, Google Hotel Ads, and Trip.com if live sync existed.

## Admin-only safety boundary
All endpoints are routed through `/api/admin` and require the existing staff access header. No public endpoint is added.

## Dry-run only boundary
No live OTA API is called. No credentials are loaded. No network client is implemented. Adapter stubs throw if live sync is requested.

## Endpoints added
- `GET /api/admin?action=ota-readiness`
- `GET /api/admin?action=ota-mappings`
- `POST /api/admin?action=ota-sync-dry-run`
- `GET /api/admin?action=ota-conflicts`

## Files added
- `api/otaSyncPlanner.js`
- `api/otaAdapters.js`
- `public/ota-sync-dry-run.js`
- `supabase/migrations/20260630030000_ota_sync_dry_run_events.sql`

## How the dry-run planner works
The planner validates a maximum 120-day date range, loads OTA channels and mappings, reads active booking holds and blocked dates, then emits day-level proposed actions.

## Source of truth rules
Manual blocked dates and active direct booking holds are protected inputs. Payment-pending direct bookings are not treated as OTA-confirmed unless already present in the active hold view.

## Manual block precedence
Manual blocks close inventory in the plan. If a manual block overlaps an active direct hold, the day becomes `needs_review`.

## Direct booking precedence
Active direct booking holds close inventory in the plan and are never auto-cancelled.

## Conflict detection
The planner flags manual block overlaps, duplicate mappings, missing room IDs, missing rate plans, disabled channels, missing credentials, invalid dates, and unmapped accommodations.

## Staff audit/event logging
Each dry run attempts to insert `inventory_dry_run` into `plp_ota_sync_events`. If logging fails, the dry run still returns with a warning.

## What is not live
No Agoda, Airbnb, Expedia, Booking.com, Google Hotel Ads, Trip.com, or direct website live write is performed. No reservation import is performed.

## How to validate
Run `npm run build`, `npm run check:viewport`, `npm run check:routes`, then test invalid dates, live mode rejection, disabled channels, missing mappings, manual blocks, and active holds.

## Deployment gates
Apply Phase 1N before Phase 2A. Confirm staff-only admin access and no public booking/payment changes.

## Rollback plan
Revert the app commit and drop the Phase 2A view/indexes if needed. No booking/payment table migration is included.

## Phase 2B handoff
Phase 2B should add an OTA reservation import review queue with no auto-confirmation and no auto-cancellation.
