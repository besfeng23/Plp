# Admin Phase 2C — OTA Conflict Resolution Console

## Summary

Phase 2C adds an admin-only OTA Conflict Resolution Console. It combines OTA inventory conflicts and OTA reservation import conflicts into a single operator review surface.

## Safety boundary

This phase is operator-review only. It records classification, notes, assignment, status, and resolution intent. It does not create bookings, confirm bookings, change payment state, send guest communications, change manual blocks, or call OTA APIs.

## Endpoints

```text
GET   /api/admin?action=ota-conflict-console
GET   /api/admin?action=ota-conflict-summary
PATCH /api/admin?action=ota-conflict-resolution
POST  /api/admin?action=ota-conflict-resolution
```

All endpoints require existing staff access.

## Files

- `api/otaConflictManager.js`
- `public/ota-conflict-console.js`
- `supabase/migrations/20260630050000_ota_conflict_resolution_console.sql`

## Sources

- `plp_ota_conflicts`
- `plp_ota_reservation_imports`

## Resolution statuses

`open`, `in_review`, `waiting_on_guest`, `waiting_on_ota`, `waiting_on_staff`, `resolved`, `ignored`.

## Resolution types

`manual_entry_required`, `contact_guest`, `contact_ota`, `maintain_direct_booking`, `maintain_manual_block`, `update_room_mapping`, `update_rate_mapping`, `reject_ota_import`, `archive_duplicate`, `no_action_required`, `unknown`.

## Rollback

Remove the UI loader and hide the console. The migration is additive and can remain without affecting booking or payment flows.

## Phase 2D handoff

Phase 2D should add richer operator workflows and validation reports while preserving review-first controls.
