# Admin Phase 1G — Availability Board V1

## Summary

Availability Board V1 adds a read-only 14-day occupancy board to PLP Resort Command. It derives room/villa occupancy and a check-in/check-out timeline from already-loaded admin reservation rows.

## Admin-only safety

This phase does not change public booking UI, booking prices, booking creation, PayPal, Xendit, webhook verification, OTA integrations, or public luxury pages.

## Data source

The board uses only rows already returned to `/admin` from the existing operations load. It does not create, update, or delete reservations or blocked dates.

## Visible fields

The board can show accommodation name, 14 upcoming date columns, open/occupied state, guest name, booking reference, and View Reservation 360 links. The timeline shows upcoming check-ins and check-outs.

## Persistence boundary

This phase is read-only. It does not block dates, unblock dates, move bookings, resolve conflicts, or write availability records. Those belong in later phases with backend schema, audit trails, and reviewed permissions.
