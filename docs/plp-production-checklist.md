# PLP production checklist

Use this checklist after a deployment or before promoting a release. Do not paste real staff access keys, PayPal credentials, Xendit secrets, webhook tokens, or Supabase service-role keys into this file.

## Temporary live test pricing

For live PayPal go-live verification the nightly rates are intentionally low so a real guest can complete a real PayPal deposit without a large charge:

| Accommodation | Nightly rate | 30% deposit (1 night) |
| --- | --- | --- |
| Grand Ocean Villa | 300 | 90 |
| Sunset Suite | 200 | 60 |
| Smart Room Premium | 100 | 30 |

- Confirm `/booking` shows `300 / 200 / 100` per night and `90 / 60 / 30` as the 30% deposit.
- The server-side deposit stored by `/api/bookings` is the source of truth; a browser-supplied amount must never override it.

## Live PayPal env var checklist (Vercel Production)

> Real PayPal payments require **live** PayPal credentials. Sandbox credentials will **not** work for real guest payment testing. Enter secrets only in Vercel Production env vars — never in code, docs, logs, or screenshots.

Confirm these are set in **Vercel → Settings → Environment Variables → Production** before real payment testing:

- `PAYPAL_MODE=live`
- `PAYPAL_CLIENT_ID` = live PayPal REST app client id
- `PAYPAL_CLIENT_SECRET` = live PayPal REST app secret
- `NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app`
- `SUPABASE_URL` = production Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` = production Supabase service role key
- `RESEND_API_KEY`, `BOOKINGS_FROM_EMAIL`, `BOOKINGS_TO_EMAIL` if email notifications are expected

Keep live and sandbox credentials separate: live mode needs live credentials and sandbox mode needs sandbox credentials. Never mix them in one environment.

## Public site route checks

- Run `npm run check:routes` against `https://plp-boracay.vercel.app`.
- Confirm `/`, `/accommodation`, `/accommodations`, `/experiences`, `/booking`, `/reservation-policy`, `/privacy`, `/terms`, and SEO landing routes respond.
- Confirm `/robots.txt` disallows `/api/` and private ops surfaces.
- Confirm `/sitemap.xml` lists guest-facing pages and does not list admin/private ops pages.

## Mobile visual QA

- Check the homepage on iPhone Safari; confirm no skip-link black strip appears above the PLP logo.
- Confirm the mobile menu opens/closes and links route correctly.
- Confirm Reserve reaches `/booking`.
- Confirm the bottom action bar does not cover important content.
- Confirm the booking form remains usable on mobile.

## Booking request test

- Select accommodation, check-in, and check-out dates.
- Confirm the page describes the submission as a reservation request.
- Confirm the guest sees that PLP reviews availability before final confirmation.
- Confirm the 30% deposit is the next payment step.
- Confirm submission alone does not promise final confirmation.

## PayPal deposit checkout flow checklist

- Confirm `/api/bookings` creates a booking reference with total, deposit, and balance amounts.
- Confirm `/api/paypal/create-session` creates the PayPal checkout order for the 30% deposit.
- Confirm the legacy `/api/xendit/create-session` alias only delegates to the PayPal route because the booking form still POSTs to it.
- Confirm `/api/paypal/capture` captures the approved PayPal order and verifies the stored booking reference, amount, and currency.
- Confirm a verified `/api/paypal/capture` sends the deposit-verified notification and leaves the booking in paid-deposit state, not confirmed.
- Confirm the success redirect only tells guests the reservation is being verified.
- Do not treat the success redirect as proof of payment.

## Legacy Xendit webhook verification checklist

- Confirm Xendit sends the expected callback token before accepting any Xendit-originated event.
- Confirm webhook events are recorded with booking reference, provider payment ID, amount, currency, and verification status.
- Confirm mismatched amount, mismatched currency, unmatched reference, and duplicate events are visible for operations review.
- Treat `/api/xendit/webhook` as the source of truth only for legacy Xendit callback events, not for PayPal captures.

## Admin reservation handoff checklist

- Confirm Reservations loads only after the staff access key is provided.
- Confirm search covers guest name, email, phone/WhatsApp, accommodation, booking reference, notes, guest count, and payment/deposit status.
- Confirm each reservation shows check-in, check-out, guest count, notes/special requests, total, deposit, balance, booking status, payment status, and payment verification status.
- Confirm action labels do not imply payment is verified before server-side payment reconciliation.

## Post-deployment verification checklist

- Run `npm run build`.
- Run `npm run check:viewport`.
- Run `npm run check:routes`.
- Manually open `/booking` and submit only safe test data.
- Manually open `/admin` and confirm no reservation data is visible without the staff access key.
- Confirm no real secrets are present in committed docs or code.

## Live PayPal go-live smoke test (post-deploy)

- Open `GET /api/paypal/health`; confirm `mode` is `live` and every `has*` field is `true` (values never exposed).
- Open `/booking`, select a room, and confirm the temporary test pricing (`300 / 200 / 100`, deposits `90 / 60 / 30`).
- Submit reservation details and continue to PayPal live checkout.
- Pay the deposit through a real PayPal account and return to `/booking/success`.
- Confirm the booking becomes deposit-paid **only** after server-side capture verification (`VERIFIED`).
- Confirm the booking stays in paid-deposit state and is not auto-confirmed; only staff final confirmation finalizes the stay.
- Confirm the guest/staff deposit-verified notification runs via the non-blocking `waitUntil` path.
- Do not merge or promote unless the Vercel preview passes.
