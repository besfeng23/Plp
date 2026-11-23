# Pueblo La Perla Boracay

Luxury editorial resort prototype for Pueblo La Perla Boracay.

## Stack

- React
- Vite
- Tailwind CSS
- lucide-react
- Vercel serverless functions
- Supabase Postgres for bookings/payments
- PayPal Checkout for reservation deposits
- Legacy Xendit webhook compatibility for payment reconciliation callbacks

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Reservation pricing

The public rate catalog in `lib/pricing.js` supplies the accommodation pages,
booking calendar and server-side quote.

| Accommodation | Nightly rate (USD) | 30% deposit for one night (USD) |
| --- | ---: | ---: |
| Grand Ocean Villa | 1,000 | 300 |
| Sunset Suite | 1,000 | 300 |
| Smart Room Premium | 1,000 | 300 |

Verify pricing and availability without entering a live payment. Use a PayPal
sandbox environment for payment rehearsals.

## Production environment variables (Vercel Production)

> **Real PayPal payments require live PayPal credentials.** Sandbox credentials
> will not work for real guest payment testing. Never commit or paste real
> credential values into code, docs, logs, screenshots, or comments — enter them
> only in the Vercel Production environment.

Configure these in **Vercel → Project → Settings → Environment Variables →
Production** before real payment testing:

```env
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=<live PayPal REST app client id>
PAYPAL_CLIENT_SECRET=<live PayPal REST app secret>
NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app
SUPABASE_URL=<production Supabase URL>
SUPABASE_SERVICE_ROLE_KEY=<production Supabase service role key>
```

Optional email variables (needed if guest/staff email notifications are expected):

```env
RESEND_API_KEY=<production Resend key>
BOOKINGS_FROM_EMAIL=<verified sender>
BOOKINGS_TO_EMAIL=<staff inbox>
LEADS_FROM_EMAIL=
LEADS_TO_EMAIL=<legacy staff routing fallback>
```

Legacy Xendit reconciliation variables remain optional and only affect the
legacy `/api/xendit/webhook` callback path; they are not required for PayPal
deposit checkout:

```env
XENDIT_SECRET_KEY=
XENDIT_WEBHOOK_TOKEN=
```


The active Vercel Supabase integration supplies `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. Reservations use the `plp_runtime` Data API
schema and its atomic booking function. For legacy local databases with PLP
tables in `public`, set `PLP_SUPABASE_SCHEMA=public`. Site subscription rows
use the `public` schema. The inquiry email endpoint uses the public
concierge address in `lib/contact.js`.

The resort site and reservation calendar are public by default. A deployment
can enable the separate site subscription feature by setting
`PLP_SUBSCRIPTION_GATE_ENABLED=true` in its build and runtime environment.

## Optional guest analytics

Set `PLP_POSTHOG_PROJECT_TOKEN`, `PLP_POSTHOG_HOST` and
`PLP_GA4_MEASUREMENT_ID` in the intended Vercel environment. Set each provider
in its own project or property. Use a separate destination for preview tests.
Disable enhanced measurement in the GA4 stream so the site sends each page
view once. The public tracker waits for consent and tracks only allowed pages
and actions. It excludes guest fields, dates and payment routes.

## PLP Telegram Command Bot

A read-only Telegram operations bot can be deployed through the Vercel API route at `/api/telegram/webhook`. It answers production, PR, PayPal health, latest booking, and payment exception questions from approved Telegram user IDs only. See `docs/plp-telegram-command-bot.md` for setup, security rules, required environment variables, and webhook configuration.

## PayPal setup

PayPal checkout must be configured with environment variable names only; never
commit or paste real credential values.

### Live (real guest payments)

```env
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=<live PayPal REST app client id>
PAYPAL_CLIENT_SECRET=<live PayPal REST app secret>
NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app
```

`PAYPAL_MODE=live` selects the live PayPal REST API base
(`https://api-m.paypal.com`); any other value falls back to the sandbox base
(`https://api-m.sandbox.paypal.com`). Live mode requires **live** PayPal REST
app credentials created in the PayPal live dashboard. Sandbox credentials will
be rejected by the live API.

### Sandbox (rehearsal only — keep separate from live)

```env
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=<sandbox PayPal REST app client id>
PAYPAL_CLIENT_SECRET=<sandbox PayPal REST app secret>
NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app
```

Do not mix sandbox and live credentials in the same environment: live mode needs
live credentials and sandbox mode needs sandbox credentials. Complete a sandbox
smoke test before switching an environment to live. If a real PayPal client id
or secret was leaked, pasted, logged, or committed anywhere, rotate it in PayPal
immediately and update the deployment environment.

## Booking/payment flow

1. Guest submits reservation details.
2. `/api/bookings` validates the request, calculates a 30% deposit, creates or updates the guest in Supabase, and creates a booking record.
3. `/api/paypal/create-session` creates the PayPal deposit checkout order for the 30% deposit and records the payment session in Supabase. The legacy `/api/xendit/create-session` path is kept only as a backward-compatible alias that delegates to this canonical PayPal route because the public booking form still POSTs to it.
4. Guest is redirected to PayPal to approve the deposit.
5. `/api/paypal/capture` captures the approved order, verifies the reference/amount/currency against the stored payment session, updates the payment record, moves the booking to paid-deposit state only when verification passes, and triggers the deposit-verified notification to the guest and staff.
6. `/api/xendit/webhook` remains the legacy Xendit callback path and applies the same token-verified reconciliation rules only for Xendit-originated events.
7. A verified deposit does not confirm the stay. The booking stays in paid-deposit state; only staff confirmation in Admin Operations finalizes it.
8. Admin can read booking/payment reconciliation and payment exceptions through `/api/admin/bookings`.

## Payment verification rules

The success redirect page is not treated as proof of payment. Real status changes come only from server-side verification: `/api/paypal/capture` for PayPal orders and `/api/xendit/webhook` only for legacy Xendit callback events.

Server-side payment events are classified as:

- `VERIFIED` — booking reference exists, payment session exists, amount matches, and received currency matches the stored expected currency (USD for the current PayPal rate catalog).
- `DUPLICATE` — event ID or return/capture processing was already handled.
- `UNMATCHED_REFERENCE` — no booking exists for the payment reference.
- `UNMATCHED_PAYMENT` — booking exists but no matching payment session exists.
- `AMOUNT_MISMATCH` — payment amount does not match the expected deposit.
- `CURRENCY_MISMATCH` — payment currency is missing or differs from the stored expected currency.

Only `VERIFIED` positive payment events can move a booking into `PAID_DEPOSIT`.
Legacy database amount fields retain `_php` suffixes; interpret amounts using their accompanying currency fields, not the suffix.

## Notes

The app includes:

- Public luxury resort website
- Accommodation page
- Experiences page
- Getting Here page
- VIP Wellness Package page
- Contact/reservation inquiry form
- PayPal-backed reservation deposit checkout
- Supabase-backed booking/payment tables
- Hardened PayPal capture, legacy webhook verification, and payment exception tracking
- Hidden guest portal mock
- Staff-gated PLP Enterprise Administration at `/admin`

The admin home offers **Manage Client** (the existing Resort Command and its reservation/payment/OTA review tools) and **Enter Client Workspace** (a PLP Enterprise-style view of real operational records). The public site does not link to the admin route. The staff access code is validated by `/api/admin` and kept in tab memory, not browser storage; protected records cannot load without valid staff access.

The client workspace reuses the current PLP API and does not copy Pandora's Flutter runtime or its AI integrations. Vision is explicitly not connected; individual staff roles require a separate reviewed authorization implementation. See `docs/plp-enterprise-admin.md` for boundaries and verification.
## Production verification

Before deploying or promoting a PLP release:

```bash
npm run build
npm run check:routes
```


Mobile visual QA:

- Check the homepage on iPhone Safari and confirm no skip-link black strip appears above the logo.
- Confirm the mobile menu opens, closes, and routes links correctly.
- Confirm the Reserve CTA reaches `/booking`.
- Confirm the bottom action bar does not cover important content.
- Confirm the booking form remains usable on mobile.

Manual `/booking` checklist:

- Confirm the page describes a reservation request, not instant confirmation.
- Confirm availability is reviewed by PLP before final confirmation.
- Confirm the next payment step is the 30% deposit and the remaining balance is clear.
- Confirm the guest sees that final confirmation follows resort review and payment verification.
- Confirm the form payload still includes guest name, email, phone/WhatsApp, accommodation, dates, guest count, and notes.

Manual `/admin` checklist:

- Open Resort Command only with the staff access key; never commit or share the key in docs.
- Confirm Reservations search/filter/sort/count still works.
- Confirm guest contact details, stay details, request notes, booking reference, totals, deposit, balance, and verification status are visible.
- Confirm staff labels separate pending request, awaiting deposit, payment processing, deposit verified, confirmed, cancelled, and review-needed states.

Payment verification reminders:

- PayPal success redirects are not proof of payment.
- `/api/paypal/capture` is the canonical PayPal deposit verification path.
- `/api/xendit/webhook` is only the legacy Xendit callback verification path.
- Staff should only issue final confirmation after PLP availability review and verified payment reconciliation.

## Live PayPal go-live smoke test

Run after deploying with `PAYPAL_MODE=live` and live PayPal credentials set in
Vercel Production:

1. Open `GET /api/paypal/health` (staff only: send the `x-plp-staff-code` header; anonymous requests get 401) and confirm `mode` is `live` and every `has*`
   field is `true`. It must never expose secret values.
2. Open `/booking`, select a room, and compare the calendar, dropdown, stay
   total and deposit against the reservation pricing table above.
3. Submit reservation details and continue to PayPal live checkout.
4. Pay the deposit through a real PayPal account.
5. Confirm you return to `/booking/success` and that the booking is marked
   deposit-paid **only** after server-side capture verification (`VERIFIED`).
6. Confirm the booking stays in paid-deposit state and is **not** auto-confirmed;
   only staff final confirmation in Admin Operations finalizes the stay.
7. Confirm the guest/staff deposit-verified notification runs via the existing
   non-blocking `waitUntil` path.

> Do not promote to production or merge unless the Vercel preview passes and live
> PayPal credentials have been entered only in Vercel Production env vars.
