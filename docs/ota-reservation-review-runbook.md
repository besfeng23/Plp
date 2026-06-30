# OTA Reservation Review Runbook

## How to stage a reservation
Open Resort Command, find **OTA Reservation Review Queue**, complete the staging form or paste raw JSON, and select **Stage for review**. The UI must show that no booking was created.

## How to review conflicts
Read the conflict summary, compare dates/accommodation against direct booking records and manual blocks, and add review notes before changing status.

## How to approve for manual entry
Use **Approve for manual entry** only when staff has decided the row can be manually entered later. This action does not create or confirm a booking.

## How to reject
Use **Reject staged import** when the payload is invalid, duplicate, unsafe, or not actionable. Rejection does not cancel anything externally.

## How to archive
Use **Archive staged import** for old reviewed records that should remain stored but no longer need active queue attention.

## What never happens automatically
No booking creation, booking confirmation, direct booking cancellation, OTA cancellation, payment mutation, guest message, live OTA import, or OTA credential use.

## How to compare with direct booking records
Use the existing reservation and Reservation 360 records as the protected source of truth. Never overwrite direct booking status from an OTA staged import.

## How to protect direct bookings
Treat direct booking overlaps as critical. Escalate to an operator and do not use Phase 2B to resolve automatically.

## How to protect manual blocks
Treat manual block overlaps as operational blocks. Confirm whether the block still applies before any manual entry.

## How to handle payment ambiguity
Payment states such as `unknown`, `paid_to_ota`, and `collect_at_property` are review hints only. Do not update PLP payment status from them.

## Incident response
If an import appears to imply automatic confirmation, stop using the queue, preserve raw payloads, notify the operator, and verify no booking/payment/webhook files were changed.
