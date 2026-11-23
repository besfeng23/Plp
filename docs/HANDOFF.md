# PLP — Handoff readiness (ownership and account inventory)

**Status: handoff-READY documentation only. Nothing has been transferred.** Every account below stays
with its current holder (Mark Johnson) until the owners explicitly decide otherwise. This document
describes *how* a transfer **would** be carried out if and when that decision is made; none of these
steps are scheduled or authorized. It contains no passwords, API keys, tokens or other credentials.

## 1. Account inventory

| System | Current account / holder | What a future handoff would involve |
|---|---|---|
| GitHub | Repository `besfeng23/Plp` (Mark) | Add the new owner as admin collaborator, or transfer the repository; branch protection and Actions secrets move with it. |
| Vercel | Team `barangayoss-projects`, project `plp` (Mark, Hobby plan) | Decide who owns hosting and billing; transfer the project to the owners' team or keep it hosted by Mark. Environment variables must be re-entered by the receiving team (they do not copy as plaintext). No plan upgrade is implied. |
| Supabase | PLP production project `jcyqixttuebxqqfkjonq` (Mark's organization) | Invite the owners to the organization or transfer the project; rotate the service-role key afterwards. |
| PayPal | Live merchant account used for 30% deposits | Merchant ownership and authorization stay with the business account holder; if it changes, new REST app credentials replace `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`. |
| Resend | Current sending account (booking/lead emails) | Domain and sender ownership; new API key replaces `RESEND_API_KEY`. |
| Google Analytics 4 | Existing GA4 property | Grant the owners Administrator access on the property. |
| PostHog | Existing project | Invite the owners to the organization/project; rotate `POSTHOG_PERSONAL_API_KEY`. |
| Telegram | Existing bot | Out of current scope (owner instruction). Would require bot token and allow-list transfer. |
| Domain | Currently `plp-boracay.vercel.app` (no custom domain) | If a custom domain is bought later, registrar and DNS control belong to the business. |
| Facebook Page | Pueblo La Perla Boracay (business portfolio "Pueblo La Perla Boracay") | Add the owners as full-control Page admins. |
| Instagram | @pueblolaperlaboracay (Business, linked to the Facebook Page) | Managed through the same business portfolio. |
| TikTok | Profile pending owner confirmation | Add to `lib/site-config.js` (`SITE.social.tiktok`) once confirmed. |

## 2. Owner access (application level)

- Owners sign in at `/owner` with a one-time email link/code (Supabase Auth). There is no shared password.
- Allow-list: `PLP_OWNER_EMAILS` (comma-separated). If it is not set, the legacy single `PLP_OWNER_EMAIL`
  is used, so current production keeps working unchanged.
- Display names: `PLP_OWNER_DISPLAY_NAMES` in the form `email=Name;email2=Name2`. Without it the office shows "Owner".
- Each owner's register items, decisions and documents are scoped to their own verified account.
- Do not remove `PLP_OWNER_EMAIL` until both owner accounts have signed in successfully with `PLP_OWNER_EMAILS`.
- Actual owner email addresses are configuration, never code; they are set only after the owners confirm them.

## 3. Secret rotation procedure (for when a transfer happens)

1. Generate the new value in the provider (never reuse old values, never paste into chat or code).
2. Enter it in Vercel → Project → Settings → Environment Variables (Production), then redeploy.
3. Verify the relevant smoke test (owner sign-in, `/api/paypal/health` with a staff code, booking quote).
4. Revoke the old value in the provider.

Secrets that would be rotated at transfer: `PLP_OWNER_SESSION_SECRET`, `PLP_STAFF_CODE` (until individual
accounts replace it), `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_CLIENT_SECRET`, `RESEND_API_KEY`,
`POSTHOG_PERSONAL_API_KEY`, `PLP_SUBSCRIPTION_SESSION_SECRET` (if the gate is ever enabled).

## 4. Transfer checklist (not started — reference only)

- [ ] Owners decide: transfer infrastructure to PLP, or Mark continues hosting.
- [ ] Owners confirm their sign-in email addresses and display names.
- [ ] Individual staff accounts provisioned (see OPERATIONS_RUNBOOK.md › Access).
- [ ] Account-by-account transfer per section 1, each followed by the section 3 rotation.
- [ ] Billing responsibility recorded for Vercel, Supabase, PayPal fees and Resend.

## 5. Database and builds
- Database history, the reconstructed booking baseline, the "Supabase Preview" check and recovery: `docs/database/plp-database-reproducibility.md`.
- Dependencies are pinned to exact versions and `package-lock.json` is committed. CI installs with `npm ci`, so a build uses exactly the versions that were tested.
  To upgrade: `npm install <pkg>@<version>`, run `npm test && npm run build`, then commit both files.

## 6. Public site and search

- Guest pages use clean URLs (for example `/accommodation`, not `/accommodation.html`). Legacy `.html` addresses redirect to the clean URL.
- Unknown addresses return a real 404 page, not the homepage.
- Internal surfaces (`/admin`, `/owner`, the Growth Plan, payment return pages, `/subscribe`, `/tg`) are marked noindex and listed in `robots.txt`.
- Public URLs are listed in `public/sitemap.xml`.

