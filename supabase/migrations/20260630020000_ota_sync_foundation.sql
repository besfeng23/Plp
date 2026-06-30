-- Phase 1N OTA sync foundation.
-- Additive admin/service-role planning tables only. No booking, payment, Xendit, PayPal, or webhook tables are altered.

create extension if not exists pgcrypto;

create table if not exists public.plp_ota_channels (
  id uuid primary key default gen_random_uuid(),
  channel_key text not null unique,
  channel_name text not null,
  status text not null default 'planning',
  connection_state text not null default 'not_connected',
  credential_state text not null default 'missing',
  inventory_sync_enabled boolean not null default false,
  reservation_import_enabled boolean not null default false,
  rate_sync_enabled boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plp_ota_channels_status_check check (status in ('planning', 'ready_for_credentials', 'credentials_configured', 'dry_run_only', 'live_disabled', 'live_enabled')),
  constraint plp_ota_channels_connection_state_check check (connection_state in ('not_connected', 'sandbox_ready', 'connected', 'error')),
  constraint plp_ota_channels_credential_state_check check (credential_state in ('missing', 'stored_outside_repo', 'configured', 'expired'))
);

create table if not exists public.plp_ota_room_mappings (
  id uuid primary key default gen_random_uuid(),
  channel_key text not null,
  internal_accommodation_name text not null,
  ota_room_id text,
  ota_room_name text,
  ota_rate_plan_id text,
  ota_rate_plan_name text,
  max_guests integer,
  sync_enabled boolean not null default false,
  mapping_status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plp_ota_room_mappings_mapping_status_check check (mapping_status in ('draft', 'needs_review', 'ready', 'disabled'))
);

create table if not exists public.plp_ota_sync_events (
  id uuid primary key default gen_random_uuid(),
  channel_key text not null,
  event_type text not null,
  mode text not null default 'planning',
  status text not null default 'pending',
  payload jsonb,
  result jsonb,
  error text,
  created_by text,
  created_at timestamptz not null default now(),
  constraint plp_ota_sync_events_mode_check check (mode in ('planning', 'dry_run', 'live')),
  constraint plp_ota_sync_events_status_check check (status in ('pending', 'succeeded', 'failed', 'skipped', 'blocked'))
);

create table if not exists public.plp_ota_conflicts (
  id uuid primary key default gen_random_uuid(),
  channel_key text not null,
  conflict_type text not null,
  internal_booking_reference text,
  ota_reservation_reference text,
  accommodation_name text,
  start_date date,
  end_date date,
  severity text not null default 'medium',
  status text not null default 'open',
  details jsonb,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plp_ota_conflicts_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint plp_ota_conflicts_status_check check (status in ('open', 'in_review', 'resolved', 'ignored'))
);

create index if not exists plp_ota_channels_channel_key_idx on public.plp_ota_channels (channel_key);
create index if not exists plp_ota_channels_status_idx on public.plp_ota_channels (status);
create index if not exists plp_ota_room_mappings_channel_key_idx on public.plp_ota_room_mappings (channel_key);
create index if not exists plp_ota_room_mappings_accommodation_idx on public.plp_ota_room_mappings (internal_accommodation_name);
create index if not exists plp_ota_room_mappings_status_idx on public.plp_ota_room_mappings (mapping_status);
create index if not exists plp_ota_sync_events_channel_key_idx on public.plp_ota_sync_events (channel_key);
create index if not exists plp_ota_sync_events_status_idx on public.plp_ota_sync_events (status);
create index if not exists plp_ota_conflicts_channel_key_idx on public.plp_ota_conflicts (channel_key);
create index if not exists plp_ota_conflicts_accommodation_idx on public.plp_ota_conflicts (accommodation_name);
create index if not exists plp_ota_conflicts_status_idx on public.plp_ota_conflicts (status);
create index if not exists plp_ota_conflicts_dates_idx on public.plp_ota_conflicts (start_date, end_date);

alter table public.plp_ota_channels enable row level security;
alter table public.plp_ota_room_mappings enable row level security;
alter table public.plp_ota_sync_events enable row level security;
alter table public.plp_ota_conflicts enable row level security;

comment on table public.plp_ota_channels is 'Admin/service-role only OTA channel planning state for future sync. RLS is enabled; no public-readable policies or anonymous grants are created.';
comment on table public.plp_ota_room_mappings is 'Admin/service-role only OTA room mapping drafts for future sync. RLS is enabled; no public-readable policies or anonymous grants are created.';
comment on table public.plp_ota_sync_events is 'Admin/service-role only OTA planning and future dry-run event log. RLS is enabled; no public-readable policies or anonymous grants are created.';
comment on table public.plp_ota_conflicts is 'Admin/service-role only OTA conflict review queue foundation. RLS is enabled; no public-readable policies or anonymous grants are created.';

insert into public.plp_ota_channels (channel_key, channel_name, notes) values
  ('agoda', 'Agoda', 'Phase 1N seed row. Planning only; not connected.'),
  ('airbnb', 'Airbnb', 'Phase 1N seed row. Planning only; not connected.'),
  ('expedia', 'Expedia', 'Phase 1N seed row. Planning only; not connected.'),
  ('booking_com', 'Booking.com', 'Phase 1N seed row. Planning only; not connected.'),
  ('direct_website', 'Direct Website', 'Phase 1N seed row. Planning only; not connected.'),
  ('google_hotel_ads', 'Google Hotel Ads', 'Phase 1N seed row. Planning only; not connected.'),
  ('trip_com', 'Trip.com', 'Phase 1N seed row. Planning only; not connected.')
on conflict (channel_key) do nothing;
