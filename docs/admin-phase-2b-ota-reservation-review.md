# Admin Phase 2B: OTA Reservation Import Review Queue

## Summary
Phase 2B adds an admin-only OTA reservation staging and review queue. Staff can paste or enter an OTA reservation payload, normalize it, validate it, see conflicts, and mark the staged import in review, rejected, archived, or approved for manual entry.

## Admin-only safety boundary
The queue is reachable only through existing staff-protected `/api/admin` actions and the Resort Command admin shell. It adds no public endpoints and no guest-facing booking UI.

## Review-first only boundary
Phase 2B never creates PLP bookings, never confirms OTA reservations, never cancels direct or OTA bookings, never mutates payment state, never sends guest messages, and never connects to live OTA APIs.

## Endpoints added
- `GET /api/admin?action=ota-reservation-imports`
- `POST /api/admin?action=ota-reservation-stage`
- `PATCH /api/admin?action=ota-reservation-review`
- `GET /api/admin?action=ota-reservation-summary`

Requests containing `createBooking: true`, `autoConfirm: true`, `mutatePayment: true`, `sendGuestMessage: true`, or `mode: live` are rejected.

## Files added
- `api/otaReservationImporter.js`
- `public/ota-reservation-review.js`
- `supabase/migrations/20260630040000_ota_reservation_review_queue.sql`
- Phase 2B docs in `docs/`

## What the queue does
- Normalizes flexible OTA reservation payloads.
- Validates dates, guests, amounts, payment state, and known accommodation names.
- Detects duplicate imports, direct booking/hold overlaps, manual block overlaps, missing room mappings, invalid accommodations, payment ambiguity, and incomplete optional contact details.
- Stores raw and normalized payloads for staff review.

## What it does not do
- No automatic booking creation.
- No payment status updates.
- No PayPal/Xendit/webhook changes.
- No live Agoda/Airbnb/Expedia/Booking.com API calls.
- No OTA credentials.
- No guest notifications.

## Conflict detection rules
Direct booking overlaps are critical. Manual block overlaps are high, or critical when a direct overlap is also present. Duplicate OTA references and invalid accommodations are high. Missing mappings and payment ambiguity are medium. Missing optional guest contact data is low.

## Payment handling rules
OTA payment state is stored as a review hint only. `unknown`, `paid_to_ota`, and `collect_at_property` are explicitly flagged for human review and must not alter PLP payment status.

## Direct booking protection
Direct bookings and active holds are treated as protected source records. OTA rows can be staged against them for review, but Phase 2B does not cancel or mutate direct bookings.

## Manual block protection
Manual blocks are treated as operational blocks. Overlapping OTA payloads are staged as conflicts for human decision-making.

## Operator approval model
`approved_for_manual_entry` means staff approved the staged import for future manual entry. It is not a booking confirmation and does not create a booking.

## Validation steps
Run:
- `node --check api/otaReservationImporter.js`
- `node --check public/ota-reservation-review.js`
- `node --check api/admin.js`
- `npm run build`
- `npm run check:viewport`
- `npm run check:routes`

## Deployment gates
Apply the Phase 2B migration before expecting persisted queue data. Confirm staff code protection remains configured. Do not deploy live OTA credentials for this phase.

## Rollback plan
Remove the admin script load, revert the API/module changes, and drop the Phase 2B table/view only if no staged records need retention.

## Phase 2C handoff
Phase 2C should build an OTA Conflict Resolution Console that remains admin-review-first with no automatic booking or payment changes.
