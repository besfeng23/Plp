# Admin Resort Command

Resort Command is the internal admin surface for reservation desk work. Phase 1A adds a Reservation 360 drawer/sheet so staff can inspect a selected reservation without leaving the admin screen.

## Served admin route reality

The production `/admin` path is the static admin flow:

1. `/admin` serves `admin.html`.
2. `admin.html` fetches `/admin-ops.html`.
3. The fetched static admin HTML is written into the page.
4. `admin.html` preserves the injected `/reservation-360.js` script path so Reservation 360 behavior attaches to the actually served admin DOM.

The React admin app in `src/admin/OpsAdminApp.jsx` is kept in parity where practical, but React-only changes do not complete served `/admin` behavior.

## Reservation 360 purpose

Reservation 360 gives staff a records-first booking inspection view from every reservation row/card. It is intended for quick review of guest, stay, payment, note, next-action, and raw-record context before staff continue normal reservation desk work.

The drawer/sheet is read-only in Phase 1A. It does not create tasks, save notes, change payment verification, or perform booking reconciliation.

## Real data shown

Reservation 360 uses existing row fields already loaded by the admin operations data. Supported field aliases include:

- Booking reference: `booking_reference`, `reference`, `booking_code`, `code`
- Guest: `guest_name`, `name`, `full_name`, `guestName`, `guest_email`, `email`, `guestEmail`, `guest_phone`, `phone`, `phone_number`, `whatsapp`, `guestPhone`, `guest_count`, `guests`, `party_size`
- Stay: `accommodation_name`, `accommodation`, `room_name`, `villa_name`, `room`, `villa`, `check_in`, `checkIn`, `arrival_date`, `arrivalDate`, `check_out`, `checkOut`, `departure_date`, `departureDate`
- Payment: `total_amount_php`, `deposit_amount_php`, `payment_amount_php`, `balance_amount_php`, `payment_status`, `booking_payment_status`, `payment_verification_status`, `verification_error`, `verification_note`, `verification_notes`, `provider`, `provider_payment_id`, `provider_session_id`, `provider_event_id`, `provider_reference_id`
- Notes/requests: `special_requests`, `notes`, `message`, `guest_notes`, `arrival_notes`

The raw record section always shows the selected row JSON for debugging. Obvious secret-like keys containing `token`, `secret`, `key`, or `password` are masked before display.

## Derived data

Phase 1A derives only lightweight labels from existing values:

- `nights`, when check-in and check-out parse as valid dates and check-out is later than check-in
- stay bucket: `Upcoming`, `In-house`, `Past`, or `Unknown`
- next action:
  - `Prepare arrival / confirm guest details`
  - `Await or review deposit`
  - `Payment review needed`
  - `No active stay — cancelled`
  - `Review booking record`

These are UI labels, not persisted workflow states.

## Not persisted yet

Internal notes persistence is not enabled yet. Reservation 360 may display existing notes/request fields from the loaded row, but it does not add a “save note” workflow or imply that staff assignments, checklists, guest memory, or tasks are saved.

## Safety boundaries

Phase 1A is admin-only UI work. It does not touch:

- public booking form behavior
- booking creation logic
- `/api/admin` booking-status behavior
- Xendit checkout or webhook logic
- payment verification semantics
- Supabase service-role logic
- OTA provider integrations, live API calls, or credentials
- public luxury website content or routing, except for existing build/static generation side effects

## Remaining Admin Phase 1 backlog

- Today Command dashboard
- Payment Review clarity
- Guest Profile summaries
- Concierge queue
- Availability board
- Housekeeping readiness
- Admin QA/mobile polish
