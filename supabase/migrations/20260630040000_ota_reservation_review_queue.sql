create extension if not exists pgcrypto;

create table if not exists public.plp_ota_reservation_imports (
  id uuid primary key default gen_random_uuid(),
  channel_key text not null check (channel_key in ('agoda','airbnb','expedia','booking_com','direct_website','google_hotel_ads','trip_com','unknown')),
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
  ota_payment_state text not null default 'unknown' check (ota_payment_state in ('unknown','unpaid','paid_to_ota','collect_at_property','partially_paid','cancelled','refunded')),
  normalized_status text not null default 'staged' check (normalized_status in ('staged','normalized','invalid','duplicate','conflict','ready_for_operator_review','rejected','approved_for_manual_entry')),
  review_status text not null default 'needs_review' check (review_status in ('needs_review','in_review','rejected','approved_for_manual_entry','archived')),
  conflict_status text not null default 'unchecked' check (conflict_status in ('unchecked','no_conflict','conflict_detected','blocked','duplicate','invalid')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  conflict_summary jsonb not null default '{}'::jsonb,
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel_key, ota_reservation_reference)
);

create index if not exists idx_plp_ota_res_import_channel on public.plp_ota_reservation_imports(channel_key);
create index if not exists idx_plp_ota_res_import_reference on public.plp_ota_reservation_imports(ota_reservation_reference);
create index if not exists idx_plp_ota_res_import_review on public.plp_ota_reservation_imports(review_status);
create index if not exists idx_plp_ota_res_import_conflict on public.plp_ota_reservation_imports(conflict_status);
create index if not exists idx_plp_ota_res_import_severity on public.plp_ota_reservation_imports(severity);
create index if not exists idx_plp_ota_res_import_dates on public.plp_ota_reservation_imports(check_in, check_out);
create index if not exists idx_plp_ota_res_import_room on public.plp_ota_reservation_imports(accommodation_name);
create index if not exists idx_plp_ota_res_import_created on public.plp_ota_reservation_imports(created_at desc);

create or replace function public.plp_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_plp_ota_reservation_imports_updated_at on public.plp_ota_reservation_imports;
create trigger trg_plp_ota_reservation_imports_updated_at
before update on public.plp_ota_reservation_imports
for each row execute function public.plp_touch_updated_at();

alter table public.plp_ota_reservation_imports enable row level security;

comment on table public.plp_ota_reservation_imports is 'Review-first OTA reservation staging queue. Rows must not automatically create direct bookings, mutate payment status, or send guest notifications.';
comment on column public.plp_ota_reservation_imports.review_status is 'approved_for_manual_entry means operator-reviewed for manual entry only; it does not create or confirm a booking.';

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
