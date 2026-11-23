# PLP database — reproducibility, history and recovery

Inventory taken read-only from production (project `jcyqixttuebxqqfkjonq`, schema `plp_runtime`) on 23 Nov 2026.
Nothing in this document or in this PR changed the production database.

## Where things live
- **`plp_runtime`** — guest booking and resort data: accommodations, guests, bookings, payments, payment events,
  blocked dates, notifications, analytics events, site content, staff identities/roles, staff tasks, owner office,
  concierge enquiries, OTA (hidden) tables. RLS is on everywhere with **no policies**, and anon/authenticated have no grants.
  Only the server, using the service role, can read or write.
- **`public`** — `plp_site_subscriptions`, `plp_site_subscription_config`, `plp_club_*`.
- The production project is shared with other systems (it is named `pandoras-box`). Their schemas and triggers aren't part of PLP.

## What was missing from migration history (now reconstructed)
The core booking schema was created outside this repo. Production history entries:
`create_plp_runtime_temporary_backend` (20260917102133), `plp_prevent_overlapping_active_bookings` (20261015092643),
`plp_atomic_booking_and_payment_operations` (20261015092748), `plp_expiring_inventory_holds_and_blocked_dates_guard`
(20261015094424), `plp_atomic_paypal_checkout_and_confirmation` (20261015094726).

| Pending file | What it is | On production |
|---|---|---|
| `supabase/pending/20261015100000_plp_core_booking_baseline.sql` | Tables, constraints, indexes, inventory trigger, `create_booking_atomic`, `confirm_booking_atomic`, PayPal RPCs, admin views, RLS and grants, copied from the production catalog | Already true. **Record, don't run:** `supabase migration repair --status applied 20261015100000` |
| `supabase/pending/20261015100100_plp_runtime_relocate_staff_tasks_and_ota.sql` | Moves `plp_staff_tasks` and `plp_ota_*` from `public` to `plp_runtime` on a clean database (the June migrations create them in `public`, but production has them in `plp_runtime`) | Already true. Record as applied the same way. |

Both files are idempotent: running them twice changes nothing (this is checked in CI).

Not reconstructed, on purpose: the triggers that call `private.*` functions owned by other systems
(`enterprise_plp_*_refresh`, `plp_realtime_*_signal`), the `plp_ai_business_context` view, and
`plp_resort_audit`, `plp_resort_write_receipts` and `plp_room_operations`. These three are legacy tables that PLP code no longer reads.
They have **RLS disabled** in production, and an owner should decide whether to enable it or drop them.

### Migration version drift (documentation only)
Several migrations were applied to production with a different timestamp from the file in this repo. For example,
repo `20261121014500` corresponds to production `20261121013449`, `20261122020000` to `20261122015527`,
`20261122030000` to `20261122020525`, `20261123060000` to `20261123055513` and `20261123060100` to `20261123055536`.
The 2026-06-30 OTA files have no production entry at all. Before anyone runs `supabase db push` against production,
reconcile the history with `supabase migration repair` (see the Supabase CLI docs). Never re-run these files on production.

## Verification (no production access needed)
`npm run verify:db` with `PLP_VERIFY_DATABASE_URL` pointing at a **disposable** PostgreSQL 17 database rebuilds
everything from `supabase/migrations` plus the reconciliation files and runs `supabase/verify/booking_baseline_checks.sql`:
valid hold, price/deposit/capacity/nights rejection, overlap refusal, adjacent stays allowed, expired holds released,
blocks vs bookings, PayPal amount check, short capture flagged, duplicate capture ignored, confirmation only after a
verified capture, views, RLS and grants. All of this runs in a transaction that is rolled back.
The script refuses Supabase-hosted URLs. CI runs it on every PR in a throwaway Postgres container (job `database`).

Known gap, for an owner decision: the PayPal RPCs check **PHP** amounts and currency (`*_php` columns), while the site
prices stays in USD (PR 3). The live checkout path in `api/` doesn't call these RPCs, so nothing breaks today,
but unify the currency before anyone wires them in.

## "Supabase Preview" check
The red **Supabase Preview** check on `main` comes from the Supabase GitHub integration attached to project
`sxxpyyyaiylucgsylbhx`, which is **not** the PLP production project and isn't visible to the PLP Supabase account.
It fails with *"Remote migration versions not found in local migrations directory"*: that project's migration history
contains versions this repo doesn't have. It deploys nothing to PLP production and isn't a required check.
Fix (owner action in the Supabase dashboard, no code change): in that project, go to Settings → Integrations → GitHub
and disconnect `besfeng23/Plp`, or point the integration at the correct project after reconciling migration history as above.
Until then it is safe to ignore. The `verify` and `database` GitHub Actions jobs are the authoritative checks.

## Recovery
- **Restore:** Supabase daily backups / PITR for project `jcyqixttuebxqqfkjonq` (dashboard → Database → Backups).
  Restoring affects every system in the shared project, so coordinate first.
- **Rebuild a fresh PLP database:** create the `plp_runtime` schema, apply `supabase/migrations` and the two reconciliation
  files in version order (exactly what `scripts/verify-db-migrations.sh` does), expose `plp_runtime` in the API settings,
  then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel. Seed `plp_accommodations` with the three stays and
  their current rates.
- **Never** drop production tables or edit historical payment rows to "fix" drift.
