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

## Individual staff accounts (PLP_AUTH_V2_ENABLED — off by default)

Production runs with the shared staff code exactly as before. Individual accounts are built but **dormant**.

Roles: **owner** (only emails in `PLP_OWNER_EMAILS`/`PLP_OWNER_EMAIL`; cannot be granted in-app), **manager**
(operations, content, OTA, club — no finance/analytics/access), **staff** (concierge inbox, tasks, read-only
availability). The shared code can never manage access.

To enable (owner approval required for each step):
1. Review and apply `supabase/pending/20261123060000_plp_auth_v2_staff_roles.sql` (not applied; see `supabase/pending/README.md`).
   Until applied, only owners can sign in individually (fail closed).
2. Set `PLP_STAFF_SESSION_SECRET` (random, ≥48 chars, distinct from the owner secret) and `PLP_AUTH_V2_ENABLED=true`, redeploy.
3. Owners sign in at `/admin` with their email + code, then grant managers/staff via `action=access` (audited in `plp_staff_access_events`).
4. When everyone has an account, set `PLP_LEGACY_STAFF_CODE_ENABLED=false` to retire the shared code.

Rollback: remove `PLP_AUTH_V2_ENABLED` (or set anything other than `true`) and redeploy — the shared code works again immediately.
Revoking a person takes effect on their next request (roles are re-checked every call).
