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
