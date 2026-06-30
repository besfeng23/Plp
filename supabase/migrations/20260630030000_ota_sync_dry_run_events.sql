-- Phase 2A OTA inventory dry-run foundation.
-- Additive only: no booking, payment, webhook, PayPal, Xendit, or public policy changes.

create index if not exists idx_plp_ota_sync_events_type_created
on public.plp_ota_sync_events (event_type, created_at desc);

create index if not exists idx_plp_ota_sync_events_mode_status
on public.plp_ota_sync_events (mode, status);

create index if not exists idx_plp_ota_conflicts_status_severity
on public.plp_ota_conflicts (status, severity);

create index if not exists idx_plp_ota_conflicts_channel_status
on public.plp_ota_conflicts (channel_key, status);

comment on table public.plp_ota_channels is 'Admin/service-role only OTA channel planning state. Phase 2A remains dry-run only; no public-readable policies, anonymous grants, or live OTA writes are enabled.';
comment on table public.plp_ota_room_mappings is 'Admin/service-role only OTA room mapping records. Phase 2A uses these for dry-run planning only and never pushes inventory to external OTAs.';
comment on table public.plp_ota_sync_events is 'Admin/service-role only OTA planning and dry-run event log. Phase 2A records dry-run summaries only; no live sync event represents an external write.';
comment on table public.plp_ota_conflicts is 'Admin/service-role only OTA conflict review queue. Phase 2A conflict rows require human review and must never auto-cancel direct or OTA bookings.';

create or replace view public.plp_ota_readiness_summary as
select
  (select count(*) from public.plp_ota_channels) as channel_count,
  (select count(*) from public.plp_ota_channels where credential_state = 'configured') as configured_credential_count,
  (select count(*) from public.plp_ota_channels where inventory_sync_enabled = true) as enabled_inventory_sync_count,
  (select count(*) from public.plp_ota_room_mappings where mapping_status = 'ready' and sync_enabled = true and ota_room_id is not null and ota_rate_plan_id is not null) as ready_room_mapping_count,
  (select count(*) from public.plp_ota_conflicts where status = 'open') as open_conflict_count;

comment on view public.plp_ota_readiness_summary is 'Service-role/admin readiness summary for Phase 2A OTA dry-run planning. No anonymous grant is provided.';
