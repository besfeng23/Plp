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
