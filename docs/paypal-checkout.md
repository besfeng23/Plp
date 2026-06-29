# PayPal checkout operations

PayPal checkout is used only to start the online reservation deposit step. A reservation request can be received without a PayPal checkout URL, but the booking must not be treated as paid or confirmed until PayPal capture verification succeeds.

## Required Vercel environment variables

Set these variables in Vercel for the deployment environment that should start PayPal checkout:

```env
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox
NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
```

Notes:

- Use `PAYPAL_MODE=sandbox` for smoke testing before using live credentials.
- `NEXT_PUBLIC_BASE_URL` should be the public site origin so PayPal return and cancel URLs point back to the deployment being tested.
- `SUPABASE_SERVICE_ROLE_KEY` is required because checkout must store the PayPal order in `plp_payments` before returning a checkout URL.
- Never paste, commit, or log real PayPal credentials, Supabase service-role keys, or access tokens.
- Rotate any credential that was pasted in chat, a ticket, logs, or git history before continuing testing.

## Safe health check

`GET /api/paypal/health` returns booleans and mode metadata only:

- `ok`
- `mode`
- `hasClientId`
- `hasClientSecret`
- `hasSupabaseUrl`
- `hasSupabaseServiceRole`
- `baseUrlSource`

It must never return actual client IDs, secrets, access tokens, service-role keys, or raw environment values.

## Sandbox smoke test

1. Configure Vercel preview or production with sandbox PayPal credentials and Supabase service-role credentials.
2. Visit `/api/paypal/health` and confirm the booleans are `true`, `mode` is `sandbox`, and `baseUrlSource` is the expected deployment URL source.
3. Open `/booking` and submit a reservation request using sandbox-safe guest details.
4. Confirm the reservation request is created and the browser redirects to PayPal only after the API returns a checkout URL.
5. Approve the order with a PayPal sandbox buyer account.
6. Return through `/api/paypal/capture` and confirm the booking still says it is being verified, not automatically confirmed by the browser redirect alone.
7. In admin Reservation 360, confirm the PayPal payment row has a stored `provider_session_id`, expected amount, currency `PHP`, and verification details.

## Expected fallback behavior

If PayPal checkout cannot start, the booking page should tell the guest:

> Your reservation request was received. The online deposit step is temporarily unavailable. Our concierge will contact you to complete the deposit.

This fallback means:

- The reservation request was received for review.
- The booking is not confirmed.
- The booking is not marked paid.
- No checkout URL is returned unless the PayPal order has been stored in `plp_payments` with `provider_session_id`.
- Staff should complete deposit follow-up manually or retry checkout after configuration/table issues are fixed.

## Safe API error codes

Checkout startup failures may return safe machine-readable codes such as:

- `PAYPAL_NOT_CONFIGURED`
- `PAYPAL_ORDER_CREATE_FAILED`
- `PAYPAL_SESSION_STORE_FAILED`
- `SUPABASE_NOT_CONFIGURED`
- `PAYMENT_TABLE_INSERT_FAILED`

These codes are safe for client/admin display. Do not return raw provider responses or secret-bearing values to browsers.
