# PLP — Operations runbook (technical maintenance)

No credentials in this file. Secret *names* only.

## Architecture
- **Frontend**: Vite + React (`src/`) plus static pages (`public/`), deployed on Vercel project `plp`.
- **API**: Vercel functions in `api/` (Hobby function-count limits → actions multiplexed via `?action=`):
  `api/plp.js` (content, analytics, club, owner → `lib/owner-handler.js`), `api/admin.js` (staff operations),
  `api/bookings.js`, `api/check-availability.js`, `api/paypal/*`, `api/subscription.js`.
- **Database**: Supabase Postgres, schema `plp_runtime`; all tables RLS-enabled, server-side service-role access only.
- **Business configuration**: `lib/site-config.js` (name, contact, socials, owner directory helpers);
  pricing `lib/pricing.js` (USD 1,000/night, 30% deposit).

## Deployments
- Every push to `main` deploys production automatically; pull requests get Vercel previews.
- Local gate before merging: `npm install && npm test && npm run build && npm run check:routes && npm run check:viewport`.
- CI: GitHub Actions `verify` (tests, viewport, build) + Vercel preview.
- Vercel Hobby has a build-rate limit; a preview failing only for that reason is infrastructure, not code.

## Database migrations
- Migrations live in `supabase/migrations/` and are reviewed in pull requests.
- **Production migrations are applied only with explicit owner approval**, never automatically by an agent.
- Core booking/payment tables predate the migration folder; see `docs/database/`.

## Backup and recovery
- Supabase daily backups (per plan). Before any approved migration, take a manual backup in the Supabase dashboard.

## Payments
- PayPal live mode. Never run test charges, captures or refunds against production.
- The server recomputes every deposit from `lib/pricing.js`; mismatches stop checkout with `PRICE_MISMATCH`.
- `GET /api/paypal/health` (staff only, `x-plp-staff-code` header) reports configuration booleans.
- Legacy `*_php` column names hold amounts in the record's own currency (see `LEGACY_AMOUNT_COLUMNS`).

## Authentication and access
- Owners: Supabase email OTP → signed `__Host-plp_owner` cookie (6 h), re-verified on every request.
  Allow-list `PLP_OWNER_EMAILS` (fallback `PLP_OWNER_EMAIL`).
- Staff: legacy shared `PLP_STAFF_CODE` (per tab, never stored in the browser). Individual accounts are
  being introduced behind `PLP_AUTH_V2_ENABLED` (default off).
- Internal legacy tools are unpublished (`internal-tools/retired/`).

## Monitoring and incidents
- Vercel runtime logs (booking and checkout failures log redaction-safe codes only).
- PostHog / GA4 for website behaviour (consent-gated).
- Incident: identify the deploy, roll back (below), then investigate.

## Rollback
- Vercel → Deployments → previous Ready production deployment → *Promote to Production*; or revert the PR on GitHub.
- Never roll back to a state that restores browser-stored staff codes or fail-open authorization.
