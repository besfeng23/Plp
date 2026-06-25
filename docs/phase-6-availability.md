# Phase 6 Availability and Anti-Double-Booking

Phase 6 adds availability safety for Pueblo La Perla reservations.

## What was added

### Database layer

New booking fields:

```txt
availability_status
availability_checked_at
```

New blocked-date fields:

```txt
status
created_by
```

New views:

```txt
plp_active_booking_holds
plp_active_blocked_dates
plp_availability_calendar
```

## Booking safety

`POST /api/bookings` now checks availability before creating a booking row.

A booking is rejected if the selected room and date range overlaps:

- an active booking hold
- a verified paid deposit booking
- a confirmed booking
- a manual blocked date

## Public availability check

```txt
POST /api/check-availability
```

Body:

```json
{
  "accommodation": "Grand Ocean Villa",
  "checkIn": "2026-07-01",
  "checkOut": "2026-07-04"
}
```

## Staff date blocking

```txt
GET /api/admin/date-blocks
POST /api/admin/date-blocks
PATCH /api/admin/date-blocks
```

All require:

```txt
x-plp-staff-code: <PLP_STAFF_CODE>
```

## Staff panel

Open:

```txt
/availability-ops.html
```

The panel can:

- view active blocked dates
- view the unified availability calendar
- add manual room/date blocks
- cancel manual blocks

## Notes

This phase prevents obvious double-booking at the API layer. A deeper future upgrade can add database-level exclusion constraints for confirmed bookings only, but the current implementation is the correct practical MVP for PLP because expired payment holds need application-level handling.
