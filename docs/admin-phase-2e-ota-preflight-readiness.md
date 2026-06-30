# Phase 2E — OTA Preflight & Operator Readiness

## Summary
Phase 2E adds an admin-only OTA Preflight & Operator Readiness dashboard for Agoda, Airbnb, Expedia, Booking.com, Direct Website, Google Hotel Ads, and Trip.com. It is the final safety/readiness layer before any future connector contract work.

## Admin-only safety boundary
All endpoints are served through `/api/admin` and require the existing staff-code gate. The dashboard is visible only inside Resort Command admin surfaces loaded after the OTA Mapping Workspace.

## Preflight-readiness-only boundary
Preflight only inspects stored planning/review data. It does not connect to OTA APIs, store credentials, push inventory, import live reservations, create bookings, confirm bookings, cancel bookings, mutate payment status, or message guests.

## Endpoints added
- `GET /api/admin?action=ota-preflight-latest`
- `GET /api/admin?action=ota-preflight-runs`
- `GET /api/admin?action=ota-preflight-items&run_id=...`
- `POST /api/admin?action=ota-preflight-run`

## Files added
- `api/otaPreflightManager.js`
- `public/ota-preflight-readiness.js`
- `supabase/migrations/20260630070000_ota_preflight_readiness.sql`
- Phase 2E operator and policy docs in `docs/`.

## What preflight checks
- Database readiness for prior OTA phases.
- Channel planning/review-only status.
- Room and rate mapping completeness.
- Reservation review queue health.
- Conflict resolution blockers and audit availability.
- Manual block and direct booking protection visibility.
- Staff task readiness.
- Security signals, including credential-shaped fields and live-mode flags.
- Deployment notes, including live route verification warnings.

## What preflight does not do
Preflight does not sync, connect, publish, push, pull, book, confirm, cancel, reconcile payments, verify payments, send messages, or store OTA credentials.

## Scoring rules
The score starts at 100. Critical failures subtract 20 points, high failures subtract 10 points, medium failures subtract 5 points, and warnings subtract 2 points. The minimum score is 0.

## Grade rules
- Green: score is at least 85 with no critical failures.
- Amber: score is at least 65 with no critical failures.
- Red: score is below 65 or any critical failure exists.

## Go/no-go rules
- `go`: green, ready for the next planning phase only.
- `conditional_go`: amber, operator cleanup required before connector planning continues.
- `no_go`: red, blocking issues must be cleared first.

## Deployment gates
Apply the Phase 2E migration, deploy the admin API/UI, run validation, and verify the admin route in the deployed environment. A green preflight result is not deployment approval for live OTA connectivity.

## Rollback plan
Remove the script load from `public/ota-mapping-workspace.js`, redeploy the previous admin API, and leave the additive tables in place or drop them in a separately reviewed database rollback if required.

## Phase 2F handoff
The next logical phase is Phase 2F: OTA Sandbox Connector Contracts. Phase 2F should remain sandbox/mock only and must use this dashboard's red/amber/green result as planning input, not as permission for live sync.
