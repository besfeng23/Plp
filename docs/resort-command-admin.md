# PLP Resort Command Admin

## Served admin route

The admin entry path is:

```text
/admin -> admin.html -> admin-ops.html plus reservation-360.js
```

Because of this, admin changes must cover both the static admin flow and the React admin app.

## Today Command purpose

Today Command is the daily operations dashboard for PLP staff. It answers the same first-shift questions from existing reservation/payment rows only:

- Who is arriving today?
- Who is currently in-house?
- Who is departing today?
- Which bookings need payment review?
- Which records need staff review?
- What should staff look at next today?

The served `/admin` experience and the React Resort Command dashboard both surface Today Command before deeper reservation tables so staff can triage the day without losing access to raw reservation records.

## Today Command classification rules

Today Command derives its lists in the browser from already-loaded operations rows:

- **Arrivals today**: `check_in`, `checkIn`, `arrival_date`, or `arrivalDate` matches today's date.
- **Departures today**: `check_out`, `checkOut`, `departure_date`, or `departureDate` matches today's date.
- **In-house**: today's date is on or after check-in and before check-out.
- **Upcoming 7 Days**: check-in is today through the next seven days, sorted by check-in date.
- **Payment review**: payment verification is missing or one of the review/exception statuses, verification note/error fields exist, or booking/payment status suggests pending payment, awaiting deposit, or payment processing.
- **Records needing review**: the row needs payment review, has missing core guest/stay fields, or has a non-final booking status that still needs staff attention.

Date parsing is intentionally defensive. Missing or malformed dates do not throw; those records fall into review-oriented areas instead of breaking the dashboard.

## Derived fields

Today Command uses safe client-side helpers for:

- `dateOnly(value)`
- `isToday(value)`
- `getCheckIn(row)`
- `getCheckOut(row)`
- `isInHouse(row)`
- `isUpcomingWithin(row, days)`

These helpers read existing row fields only. They do not create new schema requirements and do not change booking, payment, webhook, or provider semantics.

## Reservation 360 purpose

Reservation 360 is a staff detail drawer for one booking. It helps staff review the guest, stay, payment state, notes, next action, and raw row data without leaving Resort Command.

## Relationship to Reservation 360

Every Today Command section includes a **View 360** action. Filtered Today lists keep the original row object or original row index so the drawer opens the exact matching reservation, not a filtered-list position. Staff can use Today Command for triage and Reservation 360 for detailed review, payment context, notes, and raw record fallback.

## Real data

The drawer and Today Command read the existing reservation row. They use current row fields for guest name, email, phone, guest count, accommodation, check-in, check-out, booking status, payment status, verification status, provider IDs, notes, and guest requests.

## Persisted vs UI-only admin behavior

Today Command remains mostly review guidance. The staff guidance strip does not save assignments, internal notes, concierge work, housekeeping state, conflict decisions, guest memory, or departure/balance checks.

The confirmation workflow now has real saved status actions for reviewed staff decisions. The save buttons call the reviewed admin booking-status endpoint and persist status changes to the booking row. These buttons are not fake UI states.

## Safety boundaries

This phase does not change public booking behavior, booking creation, booking prices, payment verification rules, webhook handling, PayPal/Xendit provider logic, OTA connections, live OTA credentials, or public luxury pages.

## Mobile behavior

Today Command is designed to be mobile-safe at narrow widths. KPI cards stack, Today lists render as cards, View 360 buttons remain finger-friendly, and long emails, provider IDs, notes, and verification text wrap rather than causing horizontal overflow. The legacy full reservations/payment tables can still scroll horizontally where tables are intentionally retained.

The Reservation 360 drawer uses a full-width mobile sheet, sticky header, large close action, horizontal tabs, wrapping long values, and a scrollable raw record block.

## Admin Phase 1C confirmation workflow

Admin Phase 1C added a review-first workflow between payment review and final reservation confirmation. The served `/admin` shell loads `admin-confirmation-workflow.js` after the existing admin and Reservation 360 scripts. The workflow is derived from loaded operations rows only and does not alter server payment verification.

### Workflow states

The workflow displays these row groups:

- **Awaiting payment**: no verified deposit yet and no reliable provider/capture state indicating completion.
- **Payment processing**: a provider/session/capture identifier exists or payment/booking status indicates processing, but verification is not final.
- **Payment verified / availability review**: payment verification is `VERIFIED`, but staff still needs to review availability, guest details, dates, requests, and operational readiness.
- **Confirmation ready**: payment is verified and row status suggests readiness/reviewed state. Staff still performs final review.
- **Confirmed reservations**: final/confirmed operational rows such as `CONFIRMED`, `FULLY_PAID`, `CHECKED_IN`, or `CHECKED_OUT`.
- **Payment exceptions**: mismatch, unmatched, missing order/session, missing order id, database-unconfigured, failed, or other verification-error records.

### What staff can trust

Staff can trust `VERIFIED` only as a payment-verification signal from the server-side payment flow. It means the payment row and provider/capture details matched the expected reference, stored provider session, amount, and currency.

Staff must not treat the PayPal return page, a provider redirect, a visible provider id, or a pending/processing row as final proof of payment.

### What staff must manually review

Even with `VERIFIED` payment, staff must still review:

- Availability for the requested dates.
- Guest identity/contact details.
- Accommodation fit and guest count.
- Special requests and transfer/arrival notes.
- Remaining balance and payment terms.
- Any operational constraints or manual exceptions.

### Confirmation rule

A booking cannot be treated as ready for final confirmation unless payment verification is `VERIFIED` and there are no payment exceptions. Even then, final confirmation is a staff decision after availability review.

## Admin Phase 1D persisted confirmation actions

Admin Phase 1D wires the confirmation workflow to a real admin save path instead of UI-only status labels.

### Saved actions

The confirmation workflow can now call `/api/admin?action=booking-status` from served `/admin`:

- **Save processing** persists `PAYMENT_PROCESSING` for records that should remain in payment review.
- **Save final confirmation** persists `CONFIRMED` after staff confirms the booking is safe to finalize.

### Guardrails

The UI disables final confirmation when payment is not `VERIFIED`, when a payment exception exists, or when the row is already final. The backend also rejects final confirmation unless the deposit payment is verified and successful.

### What is still not saved

Phase 1D still does not persist internal notes, task assignments, concierge work, housekeeping readiness, arrival coordination, or availability review checklists. Those belong in later admin phases with dedicated schema and audit trails.

## Remaining Admin Phase 1 backlog

1. Guest Profile summaries
2. Concierge queue
3. Availability board
4. Housekeeping readiness
5. Persisted staff tasks and internal notes
6. Admin QA and mobile polish

## PayPal checkout operations

PayPal deposit checkout uses environment variables only. Do not paste real credentials into code, docs, logs, tickets, screenshots, or pull requests.

Required PayPal variables:

```env
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox
NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app
```

Use `PAYPAL_MODE=sandbox` for smoke testing before changing any production payment setting. If real credentials were ever pasted into chat, logs, a branch, or a PR, rotate them in PayPal before relying on them.

### PayPal flow

1. Booking is created first so the server has the booking reference and calculated deposit amount.
2. A PayPal order is created for that booking deposit.
3. The PayPal order id is stored on the payment row as `provider_session_id`.
4. The guest approves PayPal on the hosted PayPal approval screen.
5. The capture endpoint checks the returned order against the stored PayPal order/session id, booking reference, amount, and currency.
6. The guest reaches booking success only when `verificationStatus === VERIFIED`.

### Sandbox smoke test checklist

- Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=sandbox`, and `NEXT_PUBLIC_BASE_URL` in the server environment.
- Create a test booking and confirm a payment row is created with provider `PAYPAL` and a populated `provider_session_id`.
- Approve the order with a PayPal sandbox buyer account.
- Confirm the capture returns the guest to `/booking/success` only after `verificationStatus === VERIFIED`.
- Open Resort Command and confirm Reservations & Payments shows the `PAYPAL` provider, provider IDs, and verification status.
- Open Reservation 360 and confirm the Payment tab shows provider, session, payment, reference, webhook/event, verification status, and verification error fields from the loaded row.
- Confirm no PayPal credential values appear in browser output, server logs, committed files, or admin raw-record display.

### Failure cases and expected behavior

These outcomes should send the guest to the cancel/review path, not success:

- Missing or tampered booking reference.
- Missing payment row for the booking reference.
- Missing stored PayPal order/session id.
- Missing order id in the PayPal capture response.
- PayPal order id mismatch against `provider_session_id`.
- PayPal capture not completed.
- Amount mismatch against the expected deposit.
- Currency mismatch against PHP.
- Database unconfigured, because verification cannot be safely recorded.

### PayPal configuration health

A server-only health endpoint is available at `/api/paypal/health`. It returns configuration booleans, PayPal mode, and the configured-or-derived base URL. It must not return the PayPal client id, PayPal client secret, access tokens, raw environment variables, or any credential value.

## Admin Phase 1N OTA channel readiness

Admin Phase 1N adds a planning-only OTA Channel Readiness panel and schema foundation for future inventory sync. It is admin-only, non-functional for live OTA operations, does not connect to OTA APIs, and does not change booking creation, booking prices, PayPal, Xendit, webhook verification, or payment reconciliation logic. See `docs/admin-phase-1n-ota-channel-sync-planning.md`, `docs/ota-channel-matrix.md`, and `docs/ota-sync-runbook.md` for the readiness model and future Phase 2A handoff.
