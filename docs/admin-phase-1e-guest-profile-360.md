# Admin Phase 1E — Guest Profile 360

## Summary

Guest Profile 360 adds a read-only guest intelligence layer to PLP Resort Command. It groups already-loaded admin reservation and payment rows by guest contact, then summarizes booking history, contact details, preferred accommodation, loaded value, deposit basis, balance, request notes, and attention flags.

## Admin-only safety

This phase does not change public booking UI, booking prices, booking creation, PayPal, Xendit, webhook verification, OTA integrations, or public luxury pages.

## Data source

Guest Profile 360 uses only rows already returned to `/admin` from the existing operations load. It does not create, update, or delete guest records.

## Visible fields

Each profile card can show guest name, email or phone, loaded booking count, preferred stay/accommodation, total loaded booking value, deposit basis, balance due, first loaded request/note, attention flags, and an Open latest Reservation 360 action.

## Attention flags

Read-only flags include missing email, missing phone, repeat guest, payment exception, payment review, balance due, and arriving soon.

## Persistence boundary

This phase does not save guest notes, guest preferences, concierge tasks, housekeeping tasks, guest memories, internal staff notes, or profile edits. Those belong in later phases with backend schema, audit trails, and reviewed permissions.
