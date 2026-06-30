-- Phase 2B OTA Reservation Import Review Queue.
-- Additive admin/service-role staging only. No direct booking, payment, webhook, PayPal, Xendit, or public tables are altered.

create extension if not exists pgcrypto;

create table if not exists public.plp_ota_reservation_imports (
  id uuid primary key default gen_random_uuid(),
  channel_key text not null,
  ota_reservation_reference text not null,
  ota_guest_name text,
  ota_guest_email text,
  ota_guest_phone text,
  accommodation_name text,
  ota_room_id text,
  ota_room_name text,
  ota_rate_plan_id text,
  check_in date,
  check_out date,
  guests integer,
  currency text,
  ota_total_amount numeric,
  ota_deposit_amount numeric,
  ota_payment_state text not null default 'unknown',
  normalized_status text not null default 'staged',
  review_status text not null default 'needs_review',
  conflict_status text not null default 'unchecked',
  severity text not null default 'medium',
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  conflict_summary jsonb not null default '{}'::jsonb,
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plp_ota_reservation_imports_unique_reference unique (channel_key, ota_reservation_reference),
  constraint plp_ota_reservation_imports_channel_check check (channel_key in ('agoda', 'airbnb', 'expedia', 'booking_com', 'direct_website', 'google_hotel_ads', 'trip_com', 'unknown')),
  constraint plp_ota_reservation_imports_payment_check check (ota_payment_state in ('unknown', 'unpaid', 'paid_to_ota', 'collect_at_property', 'partially_paid', 'cancelled', 'refunded')),
  constraint plp_ota_reservation_imports_normalized_check check (normalized_status in ('staged', 'normalized', 'invalid', 'duplicate', 'conflict', 'ready_for_operator_review', 'rejected', 'approved_for_manual_entry')),
  constraint plp_ota_reservation_imports_review_check check (review_status in ('needs_review', 'in_review', 'rejected', 'approved_for_manual_entry', 'archived')),
  constraint plp_ota_reservation_imports_conflict_check check (conflict_status in ('unchecked', 'no_conflict', 'conflict_detected', 'blocked', 'duplicate', 'invalid')),
  constraint plp_ota_reservation_imports_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create index if not exists plp_ota_reservation_imports_channel_idx on public.plp_ota_reservation_imports (channel_key);
create index if not exists plp_ota_reservation_imports_reference_idx on public.plp_ota_reservation_imports (ota_reservation_reference);
create index if not exists plp_ota_reservation_imports_review_idx on public.plp_ota_reservation_imports (review_status);
create index if not exists plp_ota_reservation_imports_conflict_idx on public.plp_ota_reservation_imports (conflict_status);
create index if not exists plp_ota_reservation_imports_severity_idx on public.plp_ota_reservation_imports (severity);
create index if not exists plp_ota_reservation_imports_dates_idx on public.plp_ota_reservation_imports (check_in, check_out);
create index if not exists plp_ota_reservation_imports_accommodation_idx on public.plp_ota_reservation_imports (accommodation_name);
create index if not exists plp_ota_reservation_imports_created_idx on public.plp_ota_reservation_imports (created_at desc);

create or replace function public.plp_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plp_ota_reservation_imports_updated_at on public.plp_ota_reservation_imports;
create trigger plp_ota_reservation_imports_updated_at
before update on public.plp_ota_reservation_imports
for each row execute function public.plp_set_updated_at();

alter table public.plp_ota_reservation_imports enable row level security;

comment on table public.plp_ota_reservation_imports is 'Review-first staging queue for OTA reservation imports. Rows must not automatically create direct bookings, mutate payment status, or send guest notifications. RLS is enabled; no public-readable policies or anonymous grants are created.';
comment on column public.plp_ota_reservation_imports.review_status is 'Operator review state only. approved_for_manual_entry does not create a booking.';
comment on column public.plp_ota_reservation_imports.ota_payment_state is 'OTA payment hint for review only. Must not mutate PLP payment status.';

create or replace view public.plp_ota_reservation_review_summary as
select
  count(*)::integer as total_imports,
  count(*) filter (where review_status = 'needs_review')::integer as needs_review_count,
  count(*) filter (where conflict_status = 'conflict_detected')::integer as conflict_count,
  count(*) filter (where severity = 'critical')::integer as critical_count,
  count(*) filter (where review_status = 'approved_for_manual_entry')::integer as approved_for_manual_entry_count,
  count(*) filter (where review_status = 'rejected')::integer as rejected_count,
  max(created_at) as latest_import_at
from public.plp_ota_reservation_imports;

comment on view public.plp_ota_reservation_review_summary is 'Admin/service-role OTA reservation review counts. Review-first only; does not create bookings, mutate payments, or send guest notifications.';
