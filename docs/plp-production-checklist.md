# PLP production checklist

Use this checklist after a deployment or before promoting a release. Do not paste real staff access keys, Xendit secrets, webhook tokens, or Supabase service-role keys into this file.

## Public site route checks

- Run `npm run check:routes` against `https://plp-boracay.vercel.app`.
- Confirm `/`, `/accommodation`, `/accommodations`, `/experiences`, `/booking`, `/reservation-policy`, `/privacy`, `/terms`, and SEO landing routes respond.
- Confirm `/robots.txt` disallows `/api/` and private ops surfaces.
- Confirm `/sitemap.xml` lists guest-facing pages and does not list admin/private ops pages.


## Mobile visual QA

- Check the homepage on iPhone Safari and confirm no skip-link black strip appears above the logo.
- Confirm the mobile menu opens, closes, and routes links correctly.
- Confirm the Reserve CTA reaches `/booking`.
- Confirm the bottom action bar does not cover important content.
- Confirm the booking form remains usable on mobile.

## Booking request test

- Select accommodation, check-in, and check-out dates.
- Confirm the page describes the submission as a reservation request.
- Confirm the guest sees that PLP reviews availability before final confirmation.
- Confirm the 30% deposit is the next payment step.
- Confirm submission alone does not promise final confirmation.

## Xendit test payment flow checklist

- Confirm `/api/bookings` creates a booking reference with total, deposit, and balance amounts.
- Confirm `/api/xendit/create-session` creates the hosted checkout session for the 30% deposit.
- Confirm the success redirect only tells guests the reservation is being verified.
- Do not treat the success redirect as proof of payment.

## Webhook verification checklist

- Confirm Xendit sends the expected callback token.
- Confirm webhook events are recorded with booking reference, provider payment ID, amount, currency, and verification status.
- Confirm mismatched amount, mismatched currency, unmatched reference, and duplicate events are visible for operations review.
- Treat the webhook verification result as the payment source of truth.

## Admin reservation handoff checklist

- Confirm Reservations loads only after the staff access key is provided.
- Confirm search covers guest name, email, phone/WhatsApp, accommodation, booking reference, notes, guest count, and payment/deposit status.
- Confirm each reservation shows check-in, check-out, guest count, notes/special requests, total, deposit, balance, booking status, payment status, and payment verification status.
- Confirm action labels do not imply payment is verified before webhook reconciliation.

## Post-deployment verification checklist

- Run `npm run build`.
- Run `npm run check:routes`.
- Manually open `/booking` and submit only safe test data.
- Manually open `/admin` and confirm no reservation data is visible without the staff access key.
- Confirm no real secrets are present in committed docs or code.
