-- ROLLBACK for 20261123060000_plp_auth_v2_staff_roles (applied to production 2026-11-23 with owner approval).
-- Run ONLY after first switching individual logins off (unset PLP_AUTH_V2_ENABLED and redeploy),
-- otherwise owner/staff account endpoints will error. Destroys all individual staff role grants and
-- their audit trail; export both tables first if they hold data:
--   select * from plp_runtime.plp_staff_roles;  select * from plp_runtime.plp_staff_access_events;
-- Pre-migration snapshot (2026-11-23): neither table existed; no other objects were modified.
begin;
drop index if exists plp_runtime.plp_staff_access_events_by_target;
drop table if exists plp_runtime.plp_staff_access_events;
drop table if exists plp_runtime.plp_staff_roles;
delete from supabase_migrations.schema_migrations where name = 'plp_auth_v2_staff_roles';
commit;
