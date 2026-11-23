# Pending migrations (owner approval required)

Files here are **not applied** to any database and are deliberately outside `supabase/migrations/`
so no integration picks them up. Production database changes require Mark's explicit approval.

| File | Purpose | Needed for |
|---|---|---|
| `20261123060000_plp_auth_v2_staff_roles.sql` | Individual staff roles + append-only access audit | Manager/staff accounts under `PLP_AUTH_V2_ENABLED`. Without it, only owners (allow-list) can use individual sign-in; the shared code keeps working. |
