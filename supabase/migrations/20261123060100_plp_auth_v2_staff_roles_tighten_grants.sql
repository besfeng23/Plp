-- APPLIED TO PRODUCTION 2026-11-23 13:55 PHT with the staff-roles migration (owner-approved),
-- recorded as 20261123055536 plp_auth_v2_staff_roles_tighten_grants.
-- Supabase default privileges also granted DELETE/UPDATE/TRUNCATE to service_role on new tables.
-- Remove them so the register cannot be deleted and the access audit stays append-only.
revoke delete, truncate on plp_runtime.plp_staff_roles from service_role;
revoke update, delete, truncate on plp_runtime.plp_staff_access_events from service_role;
