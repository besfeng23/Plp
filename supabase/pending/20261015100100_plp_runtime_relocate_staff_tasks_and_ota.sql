-- Reconcile migration history with production (NOT applied anywhere by this file).
--
-- The 2026-06-30 migrations create plp_staff_tasks and the plp_ota_* tables in `public`, but in
-- production they live in `plp_runtime` (moved out-of-band; the app reads them from plp_runtime and
-- 20261122020000_plp_owner_decision_approval_workflow.sql expects plp_runtime.plp_staff_tasks).
-- On a clean database this moves them, so the full migration chain applies in order.
-- On production every step is skipped (tables already in plp_runtime): record it, don't run it —
--   supabase migration repair --status applied 20261015100100
-- Known, harmless drift: a clean database keeps a few extra review columns on plp_ota_conflicts
-- (assigned_to, operator_note, internal_note, reviewed_*, ignored_*, audit_trail) that production lacks.

create schema if not exists plp_runtime;

do $$
declare t text;
begin
  foreach t in array array['plp_staff_tasks','plp_ota_channels','plp_ota_conflicts','plp_ota_room_mappings',
    'plp_ota_sync_events','plp_ota_reservation_imports','plp_ota_conflict_resolution_events',
    'plp_ota_mapping_audit_events','plp_ota_rate_plan_mappings','plp_ota_preflight_runs','plp_ota_preflight_check_items'] loop
    if to_regclass('public.' || t) is not null and to_regclass('plp_runtime.' || t) is null then
      execute format('alter table public.%I set schema plp_runtime', t);
    end if;
  end loop;
end $$;
