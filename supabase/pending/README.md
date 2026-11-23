# Pending migrations (owner approval required)

Files here are **not applied** automatically and are deliberately outside `supabase/migrations/`
so no integration picks them up. Production database changes require Mark's explicit approval.

| File | Purpose | Status |
|---|---|---|
| `20261123060000_plp_auth_v2_staff_roles_rollback.sql` | Rollback for the individual staff roles migration | **Do not run** unless rolling back. First unset `PLP_AUTH_V2_ENABLED` and redeploy. |
| `20261123070000_plp_growth_tasks.sql` | Shared Growth Plan task progress + append-only change history | **Not applied — awaiting owner approval.** Until then `/plp-growth-plan` keeps progress per browser, labelled "saved on this device". |

Applied 2026-11-23 (owner-approved): `supabase/migrations/20261123060000_plp_auth_v2_staff_roles.sql`
and `20261123060100_plp_auth_v2_staff_roles_tighten_grants.sql`.
