# Admin Phase 1E — Guest Profile 360

## Summary

Guest Profile 360 adds a read-only guest intelligence layer to PLP Resort Command. It groups already-loaded admin reservation/payment rows by guest contact, then summarizes booking history, contact details, preferred accommodation, loaded value, deposit basis, balance, request notes, and attention flags.

## Admin-only safety

This phase does not change:

- Public booking UI
- Booking prices
- Booking creation API
- PayPal logic
- Xendit logic
- Webhook verification
- OTA integrations
- Live OTA credentials

## Data source

Guest Profile 360 uses only the rows already returned to `/admin` from the existing operations load. It does not create or update guest records.

## Visible profile fields

Each profile card can show:

- Guest name
- Email or phone
- Number of loaded bookings
- Preferred stay/accommodation based on loaded rows
- Total loaded booking value
- Deposit basis
- Balance due
- First loaded request/note
- Attention flags
- Open latest Reservation 360 action

## Attention flags

The read-only flags include:

- Missing email
- Missing phone
- Repeat guest
- Payment exception
- Payment review
- Balance due
- Arriving soon

## Reservation 360 integration

When staff opens a booking in Reservation 360, Guest Profile 360 prepends a profile summary to the drawer using the same loaded row set. This helps staff see guest context while reviewing a stay.

## Persistence boundary

This phase is read-only. It does not save:

- Guest notes
- Guest preferences
- Concierge tasks
- Housekeeping tasks
- Guest memories
- Internal staff notes
- Profile edits

Those belong in later phases with backend schema, audit trails, and reviewed permissions.
