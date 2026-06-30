# Admin Phase 1N — OTA Channel Sync Planning

## Summary

Phase 1N adds an admin-only planning and readiness layer for future OTA inventory sync. It prepares PLP Resort Command to reason about channels, room mappings, rate plans, availability precedence, and conflict review before any live OTA integration exists.

## Admin-only safety boundary

This phase is limited to `/admin` planning surfaces, documentation, and an additive Supabase schema foundation. It does not change public booking UI, booking creation, prices, PayPal, Xendit, webhook verification, or payment reconciliation logic.

## What was added

- An `OTA Channel Readiness` admin panel loaded after the existing admin QA polish layer.
- Planning-only channel cards for Agoda, Airbnb, Expedia, Booking.com, Direct Website, Google Hotel Ads, and Trip.com.
- A room mapping readiness table for Grand Ocean Villa, Sunset Suite, and Smart Room Premium.
- A non-persistent readiness checklist for operator planning.
- A Phase 2A endpoint preview that is clearly labeled as planned only.
- Additive Supabase tables for OTA channels, room mappings, sync events, and conflicts.

## What is planning-only

All Phase 1N channel states are planning-only, not connected, missing credentials, and sync disabled. The admin UI does not call OTA APIs and does not persist checklist state.

## What is not live

The following are not live in Phase 1N:

- OTA credential storage.
- OTA API connections.
- Inventory push.
- Rate push.
- Reservation import.
- Conflict auto-resolution.
- Guest messaging.
- Any booking or payment status mutation.

## Channel readiness model

Each channel is tracked by channel key, display name, status, connection state, credential state, sync flags, notes, and timestamps. Allowed lifecycle values keep the default state at `planning` and prevent accidental wording that implies live sync.

## Room mapping rules

Room mappings must start in draft and remain disabled until staff reviews the OTA room name, OTA room ID, OTA rate plan fields, max guest assumptions, and notes. Phase 1N placeholders are not operational mappings.

## Rate plan rules

Rate plan mapping is incomplete in Phase 1N. Future work must define OTA rate plan IDs and names per channel before any dry-run or approval workflow can be considered.

## Availability rules

Availability source of truth remains pending. Future sync must reconcile loaded direct bookings, manual admin blocks, and OTA events through review-first logic before any live distribution.

## Manual block precedence

Manual admin blocks must override OTA availability. A blocked date range must prevent future OTA availability pushes until reviewed and cleared by staff.

## Direct booking precedence

Confirmed direct bookings must override OTA availability. Payment-pending direct bookings must not be pushed as confirmed OTA holds, and OTA conflicts must never auto-cancel a direct booking.

## OTA conflict handling

OTA conflicts must enter a staff review queue before action. Conflicts may be categorized by channel, conflict type, accommodation, date range, references, severity, status, details, and resolution notes.

## Future Phase 2A handoff

Phase 2A may implement admin endpoints for readiness, mappings, dry-run sync, and operator approval. These endpoints are planned only in Phase 1N:

- `GET /api/admin?action=ota-readiness`
- `GET /api/admin?action=ota-mappings`
- `POST /api/admin?action=ota-sync-dry-run`
- `POST /api/admin?action=ota-sync-approve`

## Deployment gates

Before any live OTA sync, PLP must verify credentials outside the repo, complete room and rate mappings, define source-of-truth precedence, complete dry-run validation, confirm conflict queue behavior, audit staff tasks, and require explicit operator approval.
