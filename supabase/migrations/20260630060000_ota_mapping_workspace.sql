-- Phase 2D: OTA Room & Rate Mapping Workspace
-- Admin-review only. Approved mappings do not enable live OTA sync. No credentials are stored.

alter table if exists public.plp_ota_room_mappings add column if not exists mapping_status text not null default 'draft';
alter table if exists public.plp_ota_room_mappings add column if not exists review_status text not null default 'needs_review';
alter table if exists public.plp_ota_room_mappings add column if not exists internal_accommodation_name text;
alter table if exists public.plp_ota_room_mappings add column if not exists ota_room_name text;
alter table if exists public.plp_ota_room_mappings add column if not exists ota_room_id text;
alter table if exists public.plp_ota_room_mappings add column if not exists ota_property_id text;
alter table if exists public.plp_ota_room_mappings add column if not exists ota_listing_id text;
alter table if exists public.plp_ota_room_mappings add column if not exists ota_channel_room_code text;
alter table if exists public.plp_ota_room_mappings add column if not exists max_guests integer;
alter table if exists public.plp_ota_room_mappings add column if not exists notes text;
alter table if exists public.plp_ota_room_mappings add column if not exists reviewed_by text;
alter table if exists public.plp_ota_room_mappings add column if not exists reviewed_at timestamptz;
alter table if exists public.plp_ota_room_mappings add column if not exists archived_by text;
alter table if exists public.plp_ota_room_mappings add column if not exists archived_at timestamptz;
alter table if exists public.plp_ota_room_mappings add column if not exists updated_by text;
alter table if exists public.plp_ota_room_mappings add column if not exists updated_at timestamptz not null default now();
alter table if exists public.plp_ota_room_mappings add column if not exists audit_trail jsonb not null default '[]'::jsonb;

create table if not exists public.plp_ota_rate_plan_mappings (
  id uuid primary key default gen_random_uuid(),
  channel_key text not null,
  internal_accommodation_name text not null,
  ota_room_mapping_id uuid,
  internal_rate_name text not null default 'standard',
  ota_rate_plan_id text,
  ota_rate_plan_name text,
  ota_rate_code text,
  currency text default 'PHP',
  mapping_status text not null default 'draft',
  review_status text not null default 'needs_review',
  min_nights integer,
  max_nights integer,
  refundable_policy text,
  meal_plan text,
  notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  archived_by text,
  archived_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  audit_trail jsonb not null default '[]'::jsonb
);

create unique index if not exists plp_ota_rate_plan_mappings_best_effort_uidx
  on public.plp_ota_rate_plan_mappings (channel_key, internal_accommodation_name, internal_rate_name, ota_rate_plan_id)
  where ota_rate_plan_id is not null;

create table if not exists public.plp_ota_mapping_audit_events (
  id uuid primary key default gen_random_uuid(),
  mapping_table text not null check (mapping_table in ('plp_ota_room_mappings', 'plp_ota_rate_plan_mappings')),
  mapping_id uuid,
  channel_key text,
  internal_accommodation_name text,
  previous_status text,
  next_status text,
  action_type text not null check (action_type in ('create_room_mapping', 'update_room_mapping', 'archive_room_mapping', 'create_rate_mapping', 'update_rate_mapping', 'archive_rate_mapping', 'review_status_change', 'unknown')),
  operator_note text,
  actor text,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists plp_ota_room_mappings_workspace_idx on public.plp_ota_room_mappings (channel_key, internal_accommodation_name, mapping_status, review_status, updated_at desc);
create index if not exists plp_ota_rate_plan_mappings_workspace_idx on public.plp_ota_rate_plan_mappings (channel_key, internal_accommodation_name, ota_room_mapping_id, mapping_status, review_status, updated_at desc);
create index if not exists plp_ota_mapping_audit_events_mapping_idx on public.plp_ota_mapping_audit_events (mapping_table, mapping_id, created_at desc);
create index if not exists plp_ota_mapping_audit_events_channel_idx on public.plp_ota_mapping_audit_events (channel_key, internal_accommodation_name, action_type, created_at desc);

alter table public.plp_ota_rate_plan_mappings enable row level security;
alter table public.plp_ota_mapping_audit_events enable row level security;

create or replace view public.plp_ota_mapping_workspace_summary as
select
  (select count(*) from public.plp_ota_room_mappings) as total_room_mappings,
  (select count(*) from public.plp_ota_room_mappings where mapping_status = 'approved' or review_status = 'approved') as approved_room_mappings,
  (select count(*) from public.plp_ota_room_mappings where review_status in ('needs_review', 'in_review', 'rejected')) as room_mappings_needing_review,
  (select count(*) from public.plp_ota_rate_plan_mappings) as total_rate_mappings,
  (select count(*) from public.plp_ota_rate_plan_mappings where mapping_status = 'approved' or review_status = 'approved') as approved_rate_mappings,
  (select count(*) from public.plp_ota_rate_plan_mappings where review_status in ('needs_review', 'in_review', 'rejected')) as rate_mappings_needing_review,
  ((select count(*) from public.plp_ota_room_mappings where mapping_status = 'archived' or review_status = 'archived') +
   (select count(*) from public.plp_ota_rate_plan_mappings where mapping_status = 'archived' or review_status = 'archived')) as archived_mappings,
  greatest(
    (select max(updated_at) from public.plp_ota_room_mappings),
    (select max(updated_at) from public.plp_ota_rate_plan_mappings)
  ) as latest_mapping_update_at;

comment on table public.plp_ota_rate_plan_mappings is 'Phase 2D admin-review-only OTA rate plan mappings. Approved mappings do not enable live OTA sync. No credentials are stored.';
comment on table public.plp_ota_mapping_audit_events is 'Phase 2D admin-review-only OTA mapping audit log. No public-readable policies and no anon grants are added.';
comment on view public.plp_ota_mapping_workspace_summary is 'Phase 2D admin-review-only summary. Approved mappings do not enable live OTA sync.';
