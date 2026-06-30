# Admin Phase 2B — OTA Reservation Review Queue

## Summary

Phase 2B adds an admin-only OTA Reservation Review Queue. Staff can stage OTA reservation payloads, normalize the fields, detect conflicts, review the import, reject it, archive it, or approve it for future manual entry.

## Safety boundary

This phase is review-first only. It does not create bookings, confirm bookings, mutate payment status, send guest messages, connect to live OTA APIs, or add OTA credentials.

## Added endpoints

```text
GET   /api/admin?action=ota-reservation-imports
POST  /api/admin?action=ota-reservation-stage
PATCH /api/admin?action=ota-reservation-review
GET   /api/admin?action=ota-reservation-summary
```

All endpoints require the existing staff access header.

## Queue behavior

The stage endpoint accepts flexible OTA payloads, normalizes fields, validates date/accommodation/payment assumptions, checks duplicates, active direct booking holds, manual blocks, missing room mappings, and payment ambiguity, then stores a review row in `plp_ota_reservation_imports`.

## What does not happen

- No booking is created.
- No booking is confirmed.
- No direct booking is cancelled.
- No payment status is changed.
- No PayPal or Xendit logic is touched.
- No webhook logic is touched.
- No guest notification is sent.
- No live OTA API call is made.

## Phase 2C handoff

Phase 2C should build the conflict resolution console for staged OTA reservation imports and OTA inventory conflicts. It must remain human-review-first unless a later phase explicitly approves controlled automation.
