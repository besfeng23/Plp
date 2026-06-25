# Pueblo La Perla Boracay

Luxury editorial resort prototype for Pueblo La Perla Boracay.

## Stack

- React
- Vite
- Tailwind CSS
- lucide-react
- Vercel serverless functions
- Supabase Postgres for bookings/payments
- Xendit Payment Sessions for reservation deposits

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Production environment variables

Set these in Vercel before accepting real payments:

```env
NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app
XENDIT_SECRET_KEY=
XENDIT_WEBHOOK_TOKEN=
SUPABASE_URL=https://sxxpyyyaiylucgsylbhx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
```

Optional email variables:

```env
RESEND_API_KEY=
BOOKINGS_FROM_EMAIL=
BOOKINGS_TO_EMAIL=
LEADS_FROM_EMAIL=
LEADS_TO_EMAIL=
```

## Booking/payment flow

1. Guest submits reservation details.
2. `/api/bookings` validates the request, calculates a 30% deposit, creates or updates the guest in Supabase, and creates a booking record.
3. `/api/xendit/create-session` creates the Xendit hosted checkout and records the payment session in Supabase.
4. Guest is redirected to Xendit.
5. `/api/xendit/webhook` verifies the Xendit callback token, stores the payment event, validates the reference/amount/currency, updates the payment record, and only moves the booking to paid state when verification passes.
6. Admin can read booking/payment reconciliation and payment exceptions through `/api/admin/bookings`.

## Payment verification rules

The success redirect page is not treated as proof of payment. Real status changes come from the Xendit webhook.

Webhook events are classified as:

- `VERIFIED` — booking reference exists, payment session exists, amount matches, currency is PHP.
- `DUPLICATE` — webhook/event ID was already processed.
- `UNMATCHED_REFERENCE` — no booking exists for the callback reference.
- `UNMATCHED_PAYMENT` — booking exists but no matching payment session exists.
- `AMOUNT_MISMATCH` — callback amount does not match the expected deposit.
- `CURRENCY_MISMATCH` — callback currency is not PHP.

Only `VERIFIED` positive payment events can move a booking into `PAID_DEPOSIT`.

## Notes

The app includes:

- Public luxury resort website
- Accommodation page
- Experiences page
- Getting Here page
- VIP Wellness Package page
- Contact/reservation inquiry form
- Xendit-ready reservation deposit checkout
- Supabase-backed booking/payment tables
- Hardened webhook verification and payment exception tracking
- Hidden guest portal mock
- Hidden admin Resort OS mock

The dev-only Admin OS shortcut appears only when running on localhost or 127.0.0.1.
