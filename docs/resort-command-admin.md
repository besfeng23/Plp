# PLP Resort Command Admin

## Served admin route

The admin entry path is:

```text
/admin -> admin.html -> admin-ops.html plus reservation-360.js
```

Because of this, admin changes must cover both the static admin flow and the React admin app.

## Reservation 360 purpose

Reservation 360 is a staff detail drawer for one booking. It helps staff review the guest, stay, payment state, notes, next action, and raw row data without leaving Resort Command.

## Real data

The drawer reads the existing reservation row. It uses current row fields for guest name, email, phone, guest count, accommodation, check-in, check-out, booking status, payment status, verification status, provider IDs, notes, and guest requests.

## Derived data

The UI derives nights, stay bucket, and next action from existing row values. These are advisory only and do not save anything.

## Not persisted yet

Internal notes, concierge tasks, housekeeping checklist state, conflict decisions, and OTA import decisions are not saved by this phase.

## Safety boundaries

This phase does not change public booking behavior, booking creation, payment verification rules, webhook handling, privileged server-side database logic, OTA connections, or public luxury pages.

## Mobile behavior

The drawer uses a full-width mobile sheet, sticky header, large close action, horizontal tabs, wrapping long values, and a scrollable raw record block.

## Remaining Admin Phase 1 backlog

1. Today Command dashboard
2. Payment Review clarity
3. Guest Profile summaries
4. Concierge queue
5. Availability board
6. Housekeeping readiness
7. Admin QA and mobile polish

## Today Command dashboard

Today Command is the Resort Command landing dashboard for day-of operations. It is designed to help staff quickly answer who is arriving, who is currently in-house, who is departing, which bookings need payment attention, which records need staff review, and what to inspect next.

The served admin route remains the operational source of truth for this phase:

```text
/admin -> admin.html -> admin-ops.html plus reservation-360.js
```

The static served admin dashboard and the React admin dashboard both classify only the reservation, payment, and message rows already loaded from the existing admin endpoints.

## Today Command classifications

Today Command uses existing row fields only. Date fields are read from `check_in`, `checkIn`, `arrival_date`, or `arrivalDate` for arrival and from `check_out`, `checkOut`, `departure_date`, or `departureDate` for departure.

Derived groups are:

- **Arrivals today**: check-in date is today.
- **Departures today**: check-out date is today.
- **In-house stays**: today is on or after check-in and before check-out.
- **Upcoming 7 Days**: check-in is after today and within the next seven days.
- **Payment review**: payment verification is missing, pending, failed, unmatched, mismatch, needs review, not verified, has verification note/error text, or booking/payment status suggests pending payment or payment processing.
- **Records needing review**: rows that need payment review or whose booking status is not confirmed, fully paid, or cancelled.
- **Message activity**: the count of loaded notification/message rows.

Malformed or missing dates are ignored for date-based groups so the dashboard does not throw. Unknown dates are not automatically treated as arrivals, departures, or in-house stays; they appear in review areas only when payment/status fields suggest attention.

## Derived and not persisted

Today Command cards, lists, and action-strip guidance are derived UI. They do not create staff tasks, saved checklists, guest memory, assignments, or completion state.

Allowed guidance copy includes “Guidance only,” “Not persisted yet,” and “Use Reservation 360 for record inspection.” Staff should open Reservation 360 to inspect the full loaded row and raw record fallback before taking operational action.

## Mobile behavior

The served Today Command dashboard is optimized for narrow staff devices around 390px wide. KPI cards stack, Today lists render as card-style rows, long guest emails/provider IDs/notes wrap, View 360 buttons remain finger-friendly, and the page avoids horizontal overflow outside intentionally scrollable record tables.

## Relationship to Reservation 360

Today Command is a triage surface. Reservation 360 remains the detail surface. Every Today list action opens the existing Reservation 360 drawer against the original loaded reservation row, not the filtered list position, so staff can inspect guest, stay, payment, notes, next action, and raw row data.

## Remaining Admin Phase 1 backlog

1. Payment Review clarity
2. Guest Profile summaries
3. Concierge queue
4. Availability board
5. Housekeeping readiness
6. Admin QA/mobile polish
