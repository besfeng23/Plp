alter table if exists public.plp_ota_conflicts
  add column if not exists assigned_to text,
  add column if not exists resolution_type text,
  add column if not exists resolution_status text not null default 'open',
  add column if not exists operator_note text,
  add column if not exists internal_note text,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolved_by text,
  add column if not exists resolved_at timestamptz,
  add column if not exists ignored_by text,
  add column if not exists ignored_at timestamptz,
  add column if not exists audit_trail jsonb not null default '[]'::jsonb;

create table if not exists public.plp_ota_conflict_resolution_events (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid,
  source_table text not null check (source_table in ('plp_ota_conflicts','plp_ota_reservation_imports')),
  source_id uuid,
  channel_key text,
  conflict_type text,
  previous_status text,
  next_status text,
  resolution_type text,
  operator_note text,
  actor text,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_plp_ota_conflict_events_conflict on public.plp_ota_conflict_resolution_events(conflict_id);
create index if not exists idx_plp_ota_conflict_events_source on public.plp_ota_conflict_resolution_events(source_table, source_id);
create index if not exists idx_plp_ota_conflict_events_channel on public.plp_ota_conflict_resolution_events(channel_key);
create index if not exists idx_plp_ota_conflict_events_type on public.plp_ota_conflict_resolution_events(conflict_type);
create index if not exists idx_plp_ota_conflict_events_status on public.plp_ota_conflict_resolution_events(next_status);
create index if not exists idx_plp_ota_conflict_events_created on public.plp_ota_conflict_resolution_events(created_at desc);

alter table public.plp_ota_conflict_resolution_events enable row level security;

comment on table public.plp_ota_conflict_resolution_events is 'Operator-review-only audit records for OTA conflict resolution. Resolving a conflict does not automatically modify booking, payment, guest communication, or OTA state.';
comment on column public.plp_ota_conflicts.resolution_status is 'Operator-review status only. No automatic booking, payment, guest communication, or OTA mutation is implied.';

create or replace view public.plp_ota_conflict_console_summary as
select
  count(*)::integer as total_conflicts,
  count(*) filter (where coalesce(resolution_status, status, 'open') = 'open')::integer as open_count,
  count(*) filter (where coalesce(resolution_status, status, 'open') = 'in_review')::integer as in_review_count,
  count(*) filter (where coalesce(resolution_status, status, 'open') in ('waiting_on_guest','waiting_on_ota','waiting_on_staff'))::integer as waiting_count,
  count(*) filter (where coalesce(resolution_status, status, 'open') = 'resolved')::integer as resolved_count,
  count(*) filter (where coalesce(resolution_status, status, 'open') = 'ignored')::integer as ignored_count,
  count(*) filter (where severity = 'critical')::integer as critical_count,
  count(*) filter (where severity = 'high')::integer as high_count,
  count(*)::integer as inventory_conflict_count,
  0::integer as reservation_import_conflict_count,
  max(created_at) as latest_conflict_at
from public.plp_ota_conflicts;
