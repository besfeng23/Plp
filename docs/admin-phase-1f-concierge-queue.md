# Admin Phase 1F — Concierge Queue V1

## Summary

Concierge Queue V1 adds a read-only staff queue to PLP Resort Command. It derives operational follow-ups from already-loaded admin reservation and payment rows.

## Admin-only safety

This phase does not change public booking UI, booking prices, booking creation, PayPal, Xendit, webhook verification, OTA integrations, or public luxury pages.

## Data source

The queue uses only rows already returned to `/admin` from the existing operations load. It does not create, update, or delete concierge tasks.

## Derived task sources

Tasks can be created from:

- Arrival dates within the next seven days
- Booking notes and special requests
- Transfer, airport, boat, jetty, Caticlan, Kalibo, van, or car keywords
- Celebration, dining, wellness, tour, and activity keywords
- Payment review states
- Balance due amounts

## Visible task fields

Each task can show category, source, priority, guest, stay dates, accommodation, booking reference, task text, and a View Reservation 360 action.

## Persistence boundary

This phase is read-only. It does not save task status, staff assignment, notes, reminders, due dates, guest memories, or concierge completion. Those belong in later phases with backend schema, audit trails, and reviewed permissions.
