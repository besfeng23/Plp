# OTA Sync Runbook

This runbook is for future OTA sync readiness. Phase 1N does not perform live OTA sync.

## Before live sync checklist

- Confirm credentials are stored outside the repository.
- Complete room mappings for each active channel.
- Complete rate plan mappings for each active channel.
- Confirm the availability source of truth.
- Verify manual admin block precedence.
- Verify direct booking protection rules.
- Build and test a conflict review queue.
- Run dry-run sync without external writes.
- Require explicit operator approval before live push.

## Required environment variables

Placeholder names only. Do not commit values.

```env
AGODA_API_CLIENT_ID=
AGODA_API_CLIENT_SECRET=
AIRBNB_API_CLIENT_ID=
AIRBNB_API_CLIENT_SECRET=
EXPEDIA_API_CLIENT_ID=
EXPEDIA_API_CLIENT_SECRET=
BOOKING_COM_API_CLIENT_ID=
BOOKING_COM_API_CLIENT_SECRET=
GOOGLE_HOTEL_ADS_CLIENT_ID=
GOOGLE_HOTEL_ADS_CLIENT_SECRET=
TRIP_COM_API_CLIENT_ID=
TRIP_COM_API_CLIENT_SECRET=
OTA_SYNC_OPERATOR_APPROVAL_KEY=
```

## Dry-run procedure

1. Confirm credentials are present only in the deployment environment.
2. Load channel readiness and room mappings.
3. Generate a dry-run payload without sending it to any OTA.
4. Compare generated availability against manual blocks and direct bookings.
5. Record skipped, blocked, and conflict rows.
6. Do not send guest messages.
7. Do not mutate booking, payment, PayPal, Xendit, or webhook state.

## Approval procedure

1. Staff reviews dry-run results.
2. Staff reviews open conflicts.
3. Staff confirms manual blocks are respected.
4. Staff confirms direct bookings are protected.
5. Operator approves the exact channel and date range.
6. Approval is logged before any future live action.

## Rollback procedure

1. Disable sync for the affected channel.
2. Stop any queued live push worker.
3. Preserve sync event logs and conflict records.
4. Recheck manual blocks and direct bookings.
5. Contact channel support only through approved staff procedures.
6. Do not alter payment status as part of OTA rollback.

## Conflict review procedure

- Treat every OTA conflict as staff-review required.
- Never auto-cancel a direct booking.
- Never convert payment-pending direct bookings into confirmed OTA holds.
- Record channel, references, accommodation, dates, severity, and resolution notes.
- Escalate critical conflicts before any inventory push continues.

## Manual block handling

Manual admin blocks must override OTA availability. Future sync should mark blocked date ranges as unavailable for external channels until staff clears or changes the block.

## Direct booking protection rules

- Confirmed direct bookings override OTA availability.
- OTA conflicts never auto-cancel direct bookings.
- OTA sync never modifies PayPal, Xendit, payment verification, deposit verification, or webhook status.
- OTA reservation imports must enter a review queue before becoming operational records.

## Incident response

1. Disable the affected channel.
2. Capture sync event IDs, payload summaries, and conflict IDs.
3. Preserve raw records.
4. Escalate to the operator and reservation desk lead.
5. Review whether manual blocks or direct booking protection failed.
6. Do not retry live pushes until the cause is documented.

## What not to do

- Do not add secrets, tokens, client IDs, or API keys to the repository.
- Do not connect to real Agoda, Airbnb, Expedia, Booking.com, Google Hotel Ads, Trip.com, or other OTA APIs without a separate approved phase.
- Do not change public booking UI, booking creation, booking prices, PayPal, Xendit, webhook verification, or payment reconciliation logic.
- Do not send guest messages from OTA planning workflows.
- Do not auto-resolve conflicts.
