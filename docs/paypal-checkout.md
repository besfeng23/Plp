# PayPal checkout operations

PayPal checkout is used for reservation deposit startup only. It must stay review-first: a guest return from PayPal is not final confirmation, and PLP should only treat an online deposit as successful after server-side capture and verification returns `VERIFIED`.

## Required Vercel environment variables

`PAYPAL_MODE` selects the PayPal REST API base URL. `live` uses
`https://api-m.paypal.com`; any other value (including `sandbox`) uses
`https://api-m.sandbox.paypal.com`. The mode and the credentials must match: live
mode requires live credentials, sandbox mode requires sandbox credentials. Never
mix live and sandbox credentials in the same environment.

### Live (Vercel Production — real guest payments)

```env
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=<live PayPal REST app client id>
PAYPAL_CLIENT_SECRET=<live PayPal REST app secret>
NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app
SUPABASE_URL=<production Supabase URL>
SUPABASE_SERVICE_ROLE_KEY=<production Supabase service role key>
```

Real PayPal payments require **live** PayPal credentials. Sandbox credentials
will not work for real guest payment testing.

### Sandbox (rehearsal only)

```env
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=<sandbox PayPal REST app client id>
PAYPAL_CLIENT_SECRET=<sandbox PayPal REST app secret>
NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
```

Keep `PAYPAL_MODE=sandbox` until the sandbox flow is smoke-tested. Switch an
environment to `live` only after live PayPal credentials have been created and
reviewed. Enter credential values only in the Vercel environment — never in code,
docs, logs, screenshots, or comments.

## Safe health check

Use `GET /api/paypal/health` to confirm configuration presence without exposing values. The endpoint returns only:

- `ok`
- `mode`
- `hasClientId`
- `hasClientSecret`
- `hasSupabaseUrl`
- `hasSupabaseServiceRole`
- `baseUrlSource`

It must never return the PayPal client ID, client secret, access token, Supabase service-role key, or raw environment values.

## Sandbox-first setup

1. Create PayPal sandbox REST app credentials.
2. Add the sandbox client ID and secret to the Vercel environment.
3. Set `PAYPAL_MODE=sandbox`.
4. Set `NEXT_PUBLIC_BASE_URL` to the deployed site origin that PayPal should return to.
5. Confirm Supabase service-role variables are present for payment-row storage.
6. Run the health endpoint and confirm all `has*` fields are `true` and `mode` is `sandbox`.
7. Submit a test booking and complete PayPal sandbox approval.
8. Confirm the payment row stores the PayPal order ID as `provider_session_id`.
9. Confirm booking/payment state changes only after capture verification succeeds.

## Rotate pasted or leaked credentials

If a real PayPal client ID, client secret, access token, Supabase service-role key, or other production credential was pasted into chat, logs, docs, source code, screenshots, or support tickets, rotate it immediately in the provider dashboard and update Vercel with the new value. Do not try to “clean up” a leaked secret by deleting only the visible copy.

## Smoke test steps

1. Deploy the branch or preview environment with sandbox variables.
2. Open `/api/paypal/health` and verify it reports configured booleans without exposing values.
3. Open `/booking` and submit a reservation request with sandbox-safe guest details.
4. Verify the reservation request is created.
5. Verify checkout redirects only when PayPal creates an order and Supabase stores a payment row whose `provider_session_id` equals the PayPal order ID.
6. Approve payment in PayPal sandbox.
7. Verify the return page stays review-first and does not claim final confirmation by itself.
8. Verify server-side capture/reconciliation records `VERIFIED` only when reference, stored provider session, amount, and currency match.

## Live go-live smoke test

Run only after live PayPal credentials and `PAYPAL_MODE=live` are set in Vercel Production:

1. Open `/api/paypal/health` and confirm `mode` is `live` and every `has*` field is `true` (no values exposed).
2. Open `/booking` and confirm the temporary test pricing (`300 / 200 / 100`, 30% deposits `90 / 60 / 30`).
3. Submit a reservation request and continue to PayPal live checkout.
4. Pay the deposit with a real PayPal account and return to `/booking/success`.
5. Confirm the booking moves to paid-deposit state **only** after server-side capture verification returns `VERIFIED`.
6. Confirm the stay is not auto-confirmed; only staff final confirmation in Admin Operations finalizes it.
7. Confirm the deposit-verified notification runs via the non-blocking `waitUntil` path.

## Expected fallback when PayPal cannot start

If PayPal is not configured, PayPal order creation fails, Supabase is not configured, or the payment row cannot be safely stored, `/booking` should keep the created reservation request and show this guest-safe message:

> Your reservation request was received. The online deposit step is temporarily unavailable. Our concierge will contact you to complete the deposit.

The page must also make clear that the reservation is not confirmed yet, concierge follow-up is needed, and no successful online deposit happened. The API response should include a safe machine-readable code such as `PAYPAL_NOT_CONFIGURED`, `PAYPAL_ORDER_CREATE_FAILED`, `SUPABASE_NOT_CONFIGURED`, `PAYMENT_TABLE_INSERT_FAILED`, or `PAYPAL_SESSION_STORE_FAILED` without exposing raw provider responses or secrets.
