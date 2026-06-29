# PayPal checkout operations

PayPal checkout is used for reservation deposit startup only. It must stay review-first: a guest return from PayPal is not final confirmation, and PLP should only treat an online deposit as successful after server-side capture and verification returns `VERIFIED`.

## Required Vercel environment variables

Set these in Vercel for the environment being tested or deployed:

```env
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox
NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
```

`PAYPAL_MODE` should be `sandbox` until the sandbox flow is smoke-tested. Use `live` only after PayPal live credentials have been created and reviewed.

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

## Expected fallback when PayPal cannot start

If PayPal is not configured, PayPal order creation fails, Supabase is not configured, or the payment row cannot be safely stored, `/booking` should keep the created reservation request and show this guest-safe message:

> Your reservation request was received. The online deposit step is temporarily unavailable. Our concierge will contact you to complete the deposit.

The page must also make clear that the reservation is not confirmed yet, concierge follow-up is needed, and no successful online deposit happened. The API response should include a safe machine-readable code such as `PAYPAL_NOT_CONFIGURED`, `PAYPAL_ORDER_CREATE_FAILED`, `SUPABASE_NOT_CONFIGURED`, `PAYMENT_TABLE_INSERT_FAILED`, or `PAYPAL_SESSION_STORE_FAILED` without exposing raw provider responses or secrets.
