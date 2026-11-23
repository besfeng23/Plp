-- PLP core booking & payment baseline (reconstructed, NOT applied anywhere by this file).
--
-- Why: the live booking/payment schema in plp_runtime was created out-of-band
-- (production history: create_plp_runtime_temporary_backend 20260917102133,
-- plp_prevent_overlapping_active_bookings 20261015092643, plp_atomic_booking_and_payment_operations
-- 20261015092748, plp_expiring_inventory_holds_and_blocked_dates_guard 20261015094424,
-- plp_atomic_paypal_checkout_and_confirmation 20261015094726) and none of those files are in this repo.
--
-- Source: read-only catalog inventory of production (pg_catalog / pg_get_*def) on 2026-11-23.
-- Verified: applied to a disposable local PostgreSQL 17 with Supabase-style roles and exercised by
-- scripts/verify-booking-baseline.sh (booking, overlap, hold expiry, block, PayPal capture, grants).
--
-- Idempotent: every object is guarded, so on a database that already has the schema it changes nothing.
-- On production it should be RECORDED, not run:  supabase migration repair --status applied 20261015100000
-- Not included on purpose: platform triggers that call private.* functions owned by other systems
-- (enterprise_plp_*_refresh, plp_realtime_*_signal) and the plp_ai_business_context view.

create schema if not exists plp_runtime;

-- ── Tables ────────────────────────────────────────────────────────────────
create table if not exists plp_runtime.plp_accommodations (
  id uuid default gen_random_uuid() not null,
  name text not null,
  nightly_rate_php numeric(12,2) default 0 not null,
  capacity integer default 1 not null,
  bedrooms integer default 0 not null,
  is_active boolean default true not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists plp_runtime.plp_guests (
  id uuid default gen_random_uuid() not null,
  full_name text not null,
  email text not null,
  normalized_email text generated always as (lower(btrim(email))) stored,
  phone text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists plp_runtime.plp_bookings (
  id uuid default gen_random_uuid() not null,
  booking_reference text not null,
  guest_id uuid,
  accommodation_id uuid,
  accommodation_name text not null,
  check_in date not null,
  check_out date not null,
  guest_count integer default 1 not null,
  nights integer default 1 not null,
  rate_per_night_php numeric(12,2) default 0 not null,
  total_amount_php numeric(12,2) default 0 not null,
  deposit_amount_php numeric(12,2) default 0 not null,
  balance_amount_php numeric(12,2) default 0 not null,
  status text default 'PENDING_PAYMENT'::text not null,
  payment_status text default 'PENDING'::text not null,
  special_requests text,
  source text default 'website'::text not null,
  expires_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists plp_runtime.plp_payments (
  id uuid default gen_random_uuid() not null,
  booking_id uuid not null,
  provider text not null,
  provider_session_id text,
  provider_reference_id text,
  provider_payment_id text,
  checkout_url text,
  amount_php numeric(12,2) default 0 not null,
  currency text default 'PHP'::text not null,
  status text default 'PENDING'::text not null,
  verification_status text default 'PENDING'::text not null,
  verification_error text,
  last_webhook_id text,
  raw_response jsonb default '{}'::jsonb not null,
  expires_at timestamp with time zone,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists plp_runtime.plp_payment_events (
  id uuid default gen_random_uuid() not null,
  payment_id uuid,
  booking_id uuid,
  provider text not null,
  provider_event_id text,
  event_type text not null,
  provider_reference_id text,
  provider_payment_id text,
  amount_php numeric(12,2),
  currency text,
  status text,
  expected_amount_php numeric(12,2),
  expected_currency text,
  verification_status text,
  verification_notes text,
  payload jsonb default '{}'::jsonb not null,
  processed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists plp_runtime.plp_blocked_dates (
  id uuid default gen_random_uuid() not null,
  accommodation_id uuid not null,
  start_date date not null,
  end_date date not null,
  reason text,
  source text default 'admin'::text not null,
  status text default 'ACTIVE'::text not null,
  created_by text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists plp_runtime.plp_notifications (
  id uuid default gen_random_uuid() not null,
  booking_id uuid,
  payment_id uuid,
  notification_key text not null,
  recipient_type text not null,
  recipient_email text,
  channel text default 'email'::text not null,
  subject text,
  status text default 'PENDING'::text not null,
  provider text,
  provider_message_id text,
  error text,
  payload jsonb default '{}'::jsonb not null,
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists plp_runtime.plp_analytics_events (
  id uuid default gen_random_uuid() not null,
  event_name text not null,
  page_path text,
  session_id text,
  payload jsonb default '{}'::jsonb not null,
  user_agent text,
  referrer text,
  created_at timestamp with time zone default now() not null
);

create table if not exists plp_runtime.plp_site_content (
  id uuid default gen_random_uuid() not null,
  section text not null,
  status text default 'DRAFT'::text not null,
  content jsonb default '{}'::jsonb not null,
  updated_by text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists plp_runtime.plp_staff_identities (
  id uuid default gen_random_uuid() not null,
  auth_user_id uuid not null,
  email_hint text,
  display_name text not null,
  role text not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- ── Constraints (added only when missing, in dependency order) ───────────
do $$
declare c record;
begin
  for c in select * from (values
    ('plp_accommodations','plp_accommodations_pkey','PRIMARY KEY (id)'),
    ('plp_accommodations','plp_accommodations_name_key','UNIQUE (name)'),
    ('plp_accommodations','plp_accommodations_bedrooms_check','CHECK ((bedrooms >= 0))'),
    ('plp_accommodations','plp_accommodations_capacity_check','CHECK ((capacity > 0))'),
    ('plp_accommodations','plp_accommodations_nightly_rate_php_check','CHECK ((nightly_rate_php >= (0)::numeric))'),
    ('plp_guests','plp_guests_pkey','PRIMARY KEY (id)'),
    ('plp_bookings','plp_bookings_pkey','PRIMARY KEY (id)'),
    ('plp_bookings','plp_bookings_booking_reference_key','UNIQUE (booking_reference)'),
    ('plp_bookings','plp_bookings_accommodation_id_fkey','FOREIGN KEY (accommodation_id) REFERENCES plp_runtime.plp_accommodations(id) ON DELETE RESTRICT'),
    ('plp_bookings','plp_bookings_guest_id_fkey','FOREIGN KEY (guest_id) REFERENCES plp_runtime.plp_guests(id) ON DELETE RESTRICT'),
    ('plp_bookings','plp_bookings_check','CHECK ((check_out > check_in))'),
    ('plp_bookings','plp_bookings_guest_count_check','CHECK ((guest_count > 0))'),
    ('plp_bookings','plp_bookings_nights_check','CHECK ((nights > 0))'),
    ('plp_bookings','plp_bookings_rate_per_night_php_check','CHECK ((rate_per_night_php >= (0)::numeric))'),
    ('plp_bookings','plp_bookings_total_amount_php_check','CHECK ((total_amount_php >= (0)::numeric))'),
    ('plp_bookings','plp_bookings_deposit_amount_php_check','CHECK ((deposit_amount_php >= (0)::numeric))'),
    ('plp_bookings','plp_bookings_balance_amount_php_check','CHECK ((balance_amount_php >= (0)::numeric))'),
    ('plp_payments','plp_payments_pkey','PRIMARY KEY (id)'),
    ('plp_payments','plp_payments_booking_id_fkey','FOREIGN KEY (booking_id) REFERENCES plp_runtime.plp_bookings(id) ON DELETE CASCADE'),
    ('plp_payment_events','plp_payment_events_pkey','PRIMARY KEY (id)'),
    ('plp_payment_events','plp_payment_events_booking_id_fkey','FOREIGN KEY (booking_id) REFERENCES plp_runtime.plp_bookings(id) ON DELETE SET NULL'),
    ('plp_payment_events','plp_payment_events_payment_id_fkey','FOREIGN KEY (payment_id) REFERENCES plp_runtime.plp_payments(id) ON DELETE SET NULL'),
    ('plp_blocked_dates','plp_blocked_dates_pkey','PRIMARY KEY (id)'),
    ('plp_blocked_dates','plp_blocked_dates_accommodation_id_fkey','FOREIGN KEY (accommodation_id) REFERENCES plp_runtime.plp_accommodations(id) ON DELETE CASCADE'),
    ('plp_blocked_dates','plp_blocked_dates_check','CHECK ((end_date > start_date))'),
    ('plp_blocked_dates','plp_blocked_dates_status_check','CHECK ((status = ANY (ARRAY[''ACTIVE''::text, ''CANCELLED''::text])))'),
    ('plp_notifications','plp_notifications_pkey','PRIMARY KEY (id)'),
    ('plp_notifications','plp_notifications_notification_key_key','UNIQUE (notification_key)'),
    ('plp_notifications','plp_notifications_booking_id_fkey','FOREIGN KEY (booking_id) REFERENCES plp_runtime.plp_bookings(id) ON DELETE SET NULL'),
    ('plp_notifications','plp_notifications_payment_id_fkey','FOREIGN KEY (payment_id) REFERENCES plp_runtime.plp_payments(id) ON DELETE SET NULL'),
    ('plp_analytics_events','plp_analytics_events_pkey','PRIMARY KEY (id)'),
    ('plp_site_content','plp_site_content_pkey','PRIMARY KEY (id)'),
    ('plp_site_content','plp_site_content_section_key','UNIQUE (section)'),
    ('plp_site_content','plp_site_content_status_check','CHECK ((status = ANY (ARRAY[''DRAFT''::text, ''PUBLISHED''::text, ''ARCHIVED''::text])))'),
    ('plp_staff_identities','plp_staff_identities_pkey','PRIMARY KEY (id)'),
    ('plp_staff_identities','plp_staff_identities_auth_user_id_key','UNIQUE (auth_user_id)'),
    ('plp_staff_identities','plp_staff_identities_role_check','CHECK ((role = ANY (ARRAY[''owner''::text, ''manager''::text, ''reservations''::text, ''finance''::text])))')
  ) as v(tbl, con, def) loop
    if not exists (select 1 from pg_constraint where conname = c.con
                   and conrelid = format('plp_runtime.%I', c.tbl)::regclass) then
      execute format('alter table plp_runtime.%I add constraint %I %s', c.tbl, c.con, c.def);
    end if;
  end loop;
end $$;

-- ── Indexes ───────────────────────────────────────────────────────────────
create index if not exists plp_blocked_dates_active_idx on plp_runtime.plp_blocked_dates using btree (accommodation_id, start_date, end_date) where (status = 'ACTIVE'::text);
create index if not exists plp_bookings_dates_idx on plp_runtime.plp_bookings using btree (accommodation_id, check_in, check_out);
create index if not exists plp_bookings_status_idx on plp_runtime.plp_bookings using btree (status, payment_status);
create unique index if not exists plp_guests_normalized_email_uidx on plp_runtime.plp_guests using btree (normalized_email);
create unique index if not exists plp_payment_events_provider_event_uidx on plp_runtime.plp_payment_events using btree (provider, provider_event_id) where (provider_event_id is not null);
create unique index if not exists plp_payments_provider_ref_uidx on plp_runtime.plp_payments using btree (provider, provider_reference_id) where (provider_reference_id is not null);

-- ── Inventory guard: one active stay or block per accommodation and night ──
CREATE OR REPLACE FUNCTION plp_runtime.enforce_reservation_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'plp_runtime'
AS $function$
declare
  v_conflict boolean := false;
begin
  if new.accommodation_id is null then return new; end if;

  if TG_TABLE_NAME = 'plp_bookings' then
    if new.status in ('CANCELLED','FAILED','EXPIRED','REFUNDED','VOIDED','CHECKED_OUT','COMPLETED','NO_SHOW') then return new; end if;
    if not (new.status in ('PAID_DEPOSIT','CONFIRMED','CHECKED_IN','IN_HOUSE') or new.expires_at is null or new.expires_at > now()) then return new; end if;
  elsif TG_TABLE_NAME = 'plp_blocked_dates' then
    if new.status <> 'ACTIVE' then return new; end if;
  else
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.accommodation_id::text, 73421));

  if TG_TABLE_NAME = 'plp_bookings' then
    select exists (
      select 1 from plp_runtime.plp_bookings b
      where b.accommodation_id = new.accommodation_id
        and b.id <> new.id
        and daterange(b.check_in, b.check_out, '[)') && daterange(new.check_in, new.check_out, '[)')
        and b.status not in ('CANCELLED','FAILED','EXPIRED','REFUNDED','VOIDED','CHECKED_OUT','COMPLETED','NO_SHOW')
        and (b.status in ('PAID_DEPOSIT','CONFIRMED','CHECKED_IN','IN_HOUSE') or b.expires_at is null or b.expires_at > now())
    ) into v_conflict;
    if not v_conflict then
      select exists (
        select 1 from plp_runtime.plp_blocked_dates d
        where d.accommodation_id = new.accommodation_id
          and d.status = 'ACTIVE'
          and daterange(d.start_date, d.end_date, '[)') && daterange(new.check_in, new.check_out, '[)')
      ) into v_conflict;
    end if;
    if v_conflict then raise exception using errcode = '23P01', message = 'Selected accommodation is not available for those dates'; end if;
  else
    select exists (
      select 1 from plp_runtime.plp_bookings b
      where b.accommodation_id = new.accommodation_id
        and b.status not in ('CANCELLED','FAILED','EXPIRED','REFUNDED','VOIDED','CHECKED_OUT','COMPLETED','NO_SHOW')
        and (b.status in ('PAID_DEPOSIT','CONFIRMED','CHECKED_IN','IN_HOUSE') or b.expires_at is null or b.expires_at > now())
        and daterange(b.check_in, b.check_out, '[)') && daterange(new.start_date, new.end_date, '[)')
    ) into v_conflict;
    if not v_conflict then
      select exists (
        select 1 from plp_runtime.plp_blocked_dates d
        where d.accommodation_id = new.accommodation_id
          and d.id <> new.id
          and d.status = 'ACTIVE'
          and daterange(d.start_date, d.end_date, '[)') && daterange(new.start_date, new.end_date, '[)')
      ) into v_conflict;
    end if;
    if v_conflict then raise exception using errcode = '23P01', message = 'Date block overlaps active inventory'; end if;
  end if;
  return new;
end;
$function$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'plp_bookings_enforce_inventory'
                 and tgrelid = 'plp_runtime.plp_bookings'::regclass) then
    create trigger plp_bookings_enforce_inventory before insert or update on plp_runtime.plp_bookings
      for each row execute function plp_runtime.enforce_reservation_inventory();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'plp_blocked_dates_enforce_inventory'
                 and tgrelid = 'plp_runtime.plp_blocked_dates'::regclass) then
    create trigger plp_blocked_dates_enforce_inventory before insert or update on plp_runtime.plp_blocked_dates
      for each row execute function plp_runtime.enforce_reservation_inventory();
  end if;
end $$;

-- ── Atomic booking hold (called by api/_supabase.js → rpc/create_booking_atomic) ──
CREATE OR REPLACE FUNCTION plp_runtime.create_booking_atomic(p_booking jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'plp_runtime'
AS $function$
declare
  v_accommodation plp_runtime.plp_accommodations%rowtype;
  v_guest plp_runtime.plp_guests%rowtype;
  v_booking plp_runtime.plp_bookings%rowtype;
  v_email text;
  v_reference text;
  v_check_in date;
  v_check_out date;
  v_guests integer;
  v_nights integer;
  v_rate numeric;
  v_total numeric;
  v_deposit numeric;
  v_balance numeric;
begin
  v_reference := nullif(trim(p_booking->>'reference'), '');
  v_email := lower(trim(coalesce(p_booking->>'email', '')));
  v_check_in := (p_booking->>'checkIn')::date;
  v_check_out := (p_booking->>'checkOut')::date;
  v_guests := (p_booking->>'guests')::integer;
  v_nights := (p_booking->>'nights')::integer;
  v_rate := (p_booking->>'rate')::numeric;
  v_total := (p_booking->>'amount')::numeric;
  v_deposit := (p_booking->>'deposit')::numeric;
  v_balance := (p_booking->>'balance')::numeric;

  if v_reference is null or v_email = '' then
    raise exception using errcode = '22023', message = 'Booking reference and guest email are required';
  end if;
  if v_check_out <= v_check_in or v_nights < 1 or v_guests < 1 then
    raise exception using errcode = '22023', message = 'Invalid booking dates, nights, or guest count';
  end if;
  if v_nights <> (v_check_out - v_check_in) then
    raise exception using errcode = '22023', message = 'Stay length does not match the supplied dates';
  end if;

  select * into v_accommodation
  from plp_runtime.plp_accommodations
  where name = p_booking->>'accommodation' and is_active = true
  limit 1;
  if not found then
    raise exception using errcode = '22023', message = 'Accommodation is not active';
  end if;
  if v_guests > v_accommodation.capacity then
    raise exception using errcode = '22023', message = 'Guest count exceeds accommodation capacity';
  end if;
  if v_rate <> v_accommodation.nightly_rate_php then
    raise exception using errcode = '22023', message = 'Nightly rate does not match the current resort rate';
  end if;
  if v_total <> v_nights * v_accommodation.nightly_rate_php
     or v_deposit <> round(v_total * 0.30)
     or v_balance <> v_total - v_deposit then
    raise exception using errcode = '22023', message = 'Booking price or deposit is invalid';
  end if;

  insert into plp_runtime.plp_guests(full_name,email,phone)
  values (
    left(coalesce(p_booking->>'name',''),120),
    left(coalesce(p_booking->>'email',''),180),
    left(coalesce(p_booking->>'phone',''),60)
  )
  on conflict (normalized_email) do update
    set full_name = excluded.full_name, email = excluded.email,
        phone = excluded.phone, updated_at = now()
  returning * into v_guest;

  insert into plp_runtime.plp_bookings(
    booking_reference, guest_id, accommodation_id, accommodation_name,
    check_in, check_out, guest_count, nights, rate_per_night_php,
    total_amount_php, deposit_amount_php, balance_amount_php,
    status, payment_status, special_requests, source, expires_at
  )
  values (
    v_reference, v_guest.id, v_accommodation.id, v_accommodation.name,
    v_check_in, v_check_out, v_guests, v_nights, v_rate, v_total,
    v_deposit, v_balance, 'PENDING_PAYMENT', 'PENDING',
    left(coalesce(p_booking->>'message',''),1200),
    'website', now() + interval '1 hour'
  ) returning * into v_booking;

  return jsonb_build_object(
    'id', v_booking.id,
    'booking_reference', v_booking.booking_reference,
    'guest_id', v_guest.id,
    'accommodation_id', v_accommodation.id,
    'status', v_booking.status,
    'expires_at', v_booking.expires_at
  );
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'Selected accommodation is not available for those dates';
end;
$function$;

-- ── Confirmation of a verified deposit ─────────────────────────────────────
CREATE OR REPLACE FUNCTION plp_runtime.confirm_booking_atomic(p_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'plp_runtime'
AS $function$
declare
  v_booking plp_runtime.plp_bookings%rowtype;
  v_payment plp_runtime.plp_payments%rowtype;
begin
  select * into v_booking from plp_runtime.plp_bookings
  where booking_reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Booking not found');
  end if;

  if v_booking.status = 'CONFIRMED' then
    return jsonb_build_object('ok', true, 'bookingId', v_booking.id, 'reference', p_reference, 'alreadyConfirmed', true);
  end if;
  if v_booking.status <> 'PAID_DEPOSIT' then
    return jsonb_build_object('ok', false, 'error', 'Only a paid-deposit booking can be confirmed');
  end if;

  select * into v_payment from plp_runtime.plp_payments
  where booking_id = v_booking.id
  order by created_at desc limit 1 for update;
  if not found or v_payment.verification_status <> 'VERIFIED'
     or v_payment.status not in ('SUCCEEDED','CAPTURED') then
    return jsonb_build_object('ok', false, 'error', 'Deposit payment must be verified first');
  end if;

  begin
    update plp_runtime.plp_bookings set
      status = 'CONFIRMED', confirmed_at = now(), updated_at = now()
    where id = v_booking.id;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'error', 'Selected accommodation is no longer available for those dates');
  end;

  return jsonb_build_object('ok', true, 'bookingId', v_booking.id, 'reference', p_reference);
end;
$function$;

-- ── PayPal checkout session (PHP deposit) ─────────────────────────────────
CREATE OR REPLACE FUNCTION plp_runtime.create_paypal_payment_atomic(p_payment jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'plp_runtime'
AS $function$
declare
  v_booking plp_runtime.plp_bookings%rowtype;
  v_payment plp_runtime.plp_payments%rowtype;
  v_reference text;
  v_order_id text;
  v_checkout_url text;
  v_amount numeric;
  v_currency text;
begin
  v_reference := nullif(trim(p_payment->>'bookingReference'), '');
  v_order_id := nullif(trim(p_payment->>'providerSessionId'), '');
  v_checkout_url := nullif(trim(p_payment->>'checkoutUrl'), '');
  v_amount := nullif(p_payment->>'amount','')::numeric;
  v_currency := upper(trim(coalesce(p_payment->>'currency','')));

  if v_reference is null or v_order_id is null or v_checkout_url is null then
    raise exception using errcode = '22023', message = 'Booking reference, PayPal order id, and checkout URL are required';
  end if;

  select * into v_booking
  from plp_runtime.plp_bookings
  where booking_reference = v_reference
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  if v_booking.status not in ('PENDING_PAYMENT','PAYMENT_PROCESSING') then
    raise exception using errcode = '22023', message = 'Booking is not eligible for PayPal checkout';
  end if;
  if v_booking.expires_at is not null and v_booking.expires_at <= now() then
    raise exception using errcode = '22023', message = 'Booking hold expired';
  end if;
  if v_amount is null or v_amount <> v_booking.deposit_amount_php or v_currency <> 'PHP' then
    raise exception using errcode = '22023', message = 'PayPal checkout amount/currency does not match the persisted deposit';
  end if;

  select * into v_payment
  from plp_runtime.plp_payments
  where provider = 'PAYPAL' and provider_reference_id = v_reference
  limit 1
  for update;

  if found then
    update plp_runtime.plp_payments set
      provider_session_id = v_order_id,
      provider_payment_id = null,
      checkout_url = v_checkout_url,
      amount_php = v_amount,
      currency = 'PHP',
      status = 'PENDING',
      verification_status = 'PENDING',
      verification_error = null,
      last_webhook_id = null,
      raw_response = coalesce(p_payment->'rawResponse','{}'::jsonb),
      expires_at = null,
      paid_at = null,
      updated_at = now()
    where id = v_payment.id
    returning * into v_payment;
  else
    insert into plp_runtime.plp_payments(
      booking_id, provider, provider_session_id, provider_reference_id,
      checkout_url, amount_php, currency, status, verification_status,
      verification_error, last_webhook_id, raw_response, expires_at, paid_at,
      created_at, updated_at
    ) values (
      v_booking.id, 'PAYPAL', v_order_id, v_reference, v_checkout_url,
      v_amount, 'PHP', 'PENDING', 'PENDING', null, null,
      coalesce(p_payment->'rawResponse','{}'::jsonb), null, null, now(), now()
    ) returning * into v_payment;
  end if;

  update plp_runtime.plp_bookings set
    status = 'PAYMENT_PROCESSING',
    payment_status = 'PROCESSING',
    expires_at = now() + interval '3 hours',
    updated_at = now()
  where id = v_booking.id;

  return jsonb_build_object(
    'id', v_payment.id,
    'booking_id', v_payment.booking_id,
    'provider', v_payment.provider,
    'provider_session_id', v_payment.provider_session_id,
    'provider_reference_id', v_payment.provider_reference_id,
    'checkout_url', v_payment.checkout_url,
    'amount_php', v_payment.amount_php,
    'currency', v_payment.currency,
    'status', v_payment.status,
    'verification_status', v_payment.verification_status,
    'created_at', v_payment.created_at
  );
end;
$function$;

-- ── PayPal capture verification (idempotent per capture id) ────────────────
CREATE OR REPLACE FUNCTION plp_runtime.record_paypal_capture_atomic(p_event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'plp_runtime'
AS $function$
declare
  v_booking plp_runtime.plp_bookings%rowtype;
  v_payment plp_runtime.plp_payments%rowtype;
  v_verification text;
  v_note text;
  v_amount numeric;
  v_currency text;
  v_status text;
  v_order text;
  v_reference text;
  v_event_key text;
begin
  v_reference := nullif(trim(p_event->>'bookingReference'), '');
  v_order := nullif(trim(p_event->>'orderId'), '');
  v_amount := nullif(p_event->>'amount','')::numeric;
  v_currency := upper(trim(coalesce(p_event->>'currency','')));
  v_status := upper(trim(coalesce(p_event->>'status','')));
  v_event_key := coalesce(nullif(trim(p_event->>'captureId'),''), v_order);

  select * into v_booking
  from plp_runtime.plp_bookings
  where booking_reference = v_reference
  for update;
  if not found then
    return jsonb_build_object('verificationStatus','UNMATCHED_REFERENCE','verificationNote','No booking found.');
  end if;

  select * into v_payment
  from plp_runtime.plp_payments
  where booking_id = v_booking.id and provider = 'PAYPAL'
  order by created_at desc
  limit 1 for update;
  if not found then
    return jsonb_build_object('verificationStatus','UNMATCHED_PAYMENT','verificationNote','No PayPal payment session found.');
  end if;

  if v_event_key is not null and exists (
    select 1 from plp_runtime.plp_payment_events
    where provider = 'PAYPAL' and provider_event_id = v_event_key
  ) then
    return jsonb_build_object('verificationStatus','DUPLICATE','verificationNote','Capture event already processed.');
  end if;

  v_verification := 'VERIFIED';
  v_note := 'PayPal capture matched booking, stored order ID, amount, and PHP currency.';
  if coalesce(v_payment.provider_session_id,'') = '' or v_order is null or v_payment.provider_session_id <> v_order then
    v_verification := 'ORDER_ID_MISMATCH'; v_note := 'PayPal order ID does not match stored order session.';
  elsif v_status <> 'COMPLETED' then
    v_verification := 'CAPTURE_NOT_COMPLETED'; v_note := 'PayPal capture was not completed.';
  elsif v_currency <> 'PHP' then
    v_verification := 'CURRENCY_MISMATCH'; v_note := 'Expected PHP.';
  elsif v_amount is null or v_amount <> v_payment.amount_php then
    v_verification := 'AMOUNT_MISMATCH'; v_note := 'Captured amount does not match expected deposit.';
  end if;

  insert into plp_runtime.plp_payment_events(
    payment_id,booking_id,provider,provider_event_id,event_type,
    provider_reference_id,provider_payment_id,amount_php,currency,status,
    expected_amount_php,expected_currency,verification_status,verification_notes,payload,processed_at
  ) values (
    v_payment.id,v_booking.id,'PAYPAL',v_event_key,'PAYPAL.ORDER.CAPTURE',
    v_reference,coalesce(p_event->>'captureId',v_order),v_amount,v_currency,v_status,
    v_payment.amount_php,'PHP',v_verification,v_note,coalesce(p_event->'payload','{}'::jsonb),now()
  );

  if v_verification = 'VERIFIED' then
    update plp_runtime.plp_payments set
      provider_payment_id = coalesce(p_event->>'captureId',v_order),
      status = 'SUCCEEDED', verification_status = 'VERIFIED',
      verification_error = null, last_webhook_id = v_event_key,
      paid_at = now(), raw_response = coalesce(p_event->'payload','{}'::jsonb), updated_at = now()
    where id = v_payment.id;

    update plp_runtime.plp_bookings set status='PAID_DEPOSIT', payment_status='SUCCEEDED', updated_at=now()
    where id = v_booking.id;
  else
    update plp_runtime.plp_payments set
      verification_status = v_verification, verification_error = v_note,
      last_webhook_id = v_event_key,
      raw_response = coalesce(p_event->'payload','{}'::jsonb), updated_at = now()
    where id = v_payment.id;
  end if;

  return jsonb_build_object('verificationStatus',v_verification,'verificationNote',v_note,'bookingId',v_booking.id);
end;
$function$;

-- ── Read views used by the admin ───────────────────────────────────────────
create or replace view plp_runtime.plp_active_blocked_dates as
 SELECT d.id, d.accommodation_id, d.start_date, d.end_date, d.reason, d.source, d.status,
    d.created_by, d.created_at, d.updated_at, a.name AS accommodation_name
   FROM plp_runtime.plp_blocked_dates d
     JOIN plp_runtime.plp_accommodations a ON a.id = d.accommodation_id
  WHERE d.status = 'ACTIVE'::text;

create or replace view plp_runtime.plp_active_booking_holds as
 SELECT id, booking_reference, guest_id, accommodation_id, accommodation_name, check_in, check_out,
    guest_count, nights, rate_per_night_php, total_amount_php, deposit_amount_php, balance_amount_php,
    status, payment_status, special_requests, source, expires_at, confirmed_at, cancelled_at, created_at, updated_at
   FROM plp_runtime.plp_bookings b
  WHERE (status <> ALL (ARRAY['CANCELLED'::text, 'FAILED'::text, 'EXPIRED'::text, 'REFUNDED'::text, 'VOIDED'::text, 'CHECKED_OUT'::text, 'COMPLETED'::text, 'NO_SHOW'::text]))
    AND ((status = ANY (ARRAY['PAID_DEPOSIT'::text, 'CONFIRMED'::text, 'CHECKED_IN'::text, 'IN_HOUSE'::text])) OR expires_at IS NULL OR expires_at > now());

create or replace view plp_runtime.plp_availability_calendar as
 SELECT b.id, b.accommodation_id, b.accommodation_name, b.check_in AS start_date, b.check_out AS end_date,
    'booking'::text AS source_type, b.booking_reference AS reference, b.status, b.created_at
   FROM plp_runtime.plp_active_booking_holds b
UNION ALL
 SELECT d.id, d.accommodation_id, a.name AS accommodation_name, d.start_date, d.end_date,
    'blocked_date'::text AS source_type, d.id::text AS reference, d.status, d.created_at
   FROM plp_runtime.plp_active_blocked_dates d
     JOIN plp_runtime.plp_accommodations a ON a.id = d.accommodation_id;

create or replace view plp_runtime.plp_notification_activity as
 SELECT id, booking_id, payment_id, notification_key, recipient_type, recipient_email, channel, subject,
    status, provider, provider_message_id, error, payload, sent_at, created_at, updated_at
   FROM plp_runtime.plp_notifications n;

create or replace view plp_runtime.plp_payment_exceptions as
 SELECT id, booking_id, payment_id, provider, provider_event_id, event_type, provider_reference_id,
    provider_payment_id, amount_php, currency, status, expected_amount_php, expected_currency,
    verification_status, verification_notes, payload, processed_at, created_at
   FROM plp_runtime.plp_payment_events e
  WHERE COALESCE(verification_status, ''::text) <> ALL (ARRAY[''::text, 'VERIFIED'::text, 'DUPLICATE'::text]);

create or replace view plp_runtime.plp_payment_reconciliation as
 SELECT b.id AS booking_id, b.booking_reference, b.status AS booking_status, b.payment_status AS booking_payment_status,
    b.accommodation_name, b.check_in, b.check_out, b.total_amount_php, b.deposit_amount_php, b.balance_amount_php,
    g.full_name AS guest_name, g.email AS guest_email, g.phone AS guest_phone,
    p.id AS payment_id, p.provider, p.provider_reference_id, p.provider_session_id, p.provider_payment_id,
    p.amount_php AS payment_amount_php, p.currency AS payment_currency, p.status AS payment_status,
    p.verification_status AS payment_verification_status, p.verification_error,
    p.created_at AS payment_created_at, p.paid_at, b.created_at AS booking_created_at
   FROM plp_runtime.plp_bookings b
     LEFT JOIN plp_runtime.plp_guests g ON g.id = b.guest_id
     LEFT JOIN LATERAL ( SELECT p1.id, p1.booking_id, p1.provider, p1.provider_session_id, p1.provider_reference_id,
            p1.provider_payment_id, p1.checkout_url, p1.amount_php, p1.currency, p1.status, p1.verification_status,
            p1.verification_error, p1.last_webhook_id, p1.raw_response, p1.expires_at, p1.paid_at, p1.created_at, p1.updated_at
           FROM plp_runtime.plp_payments p1
          WHERE p1.booking_id = b.id
          ORDER BY p1.created_at DESC
         LIMIT 1) p ON true;

-- ── Row level security and grants: server (service_role) only ─────────────
-- Matches production: RLS on with no policies, nothing for anon/authenticated,
-- service_role gets select/insert/update/delete (staff identities read-only).
do $$
declare t text;
begin
  foreach t in array array['plp_accommodations','plp_guests','plp_bookings','plp_payments','plp_payment_events',
    'plp_blocked_dates','plp_notifications','plp_analytics_events','plp_site_content','plp_staff_identities',
    'plp_active_blocked_dates','plp_active_booking_holds','plp_availability_calendar','plp_notification_activity',
    'plp_payment_exceptions','plp_payment_reconciliation'] loop
    execute format('revoke all on plp_runtime.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on plp_runtime.%I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on plp_runtime.%I from authenticated', t); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      if t = 'plp_staff_identities' then execute format('grant select on plp_runtime.%I to service_role', t);
      else execute format('grant select, insert, update, delete on plp_runtime.%I to service_role', t); end if;
    end if;
  end loop;
  foreach t in array array['plp_accommodations','plp_guests','plp_bookings','plp_payments','plp_payment_events',
    'plp_blocked_dates','plp_notifications','plp_analytics_events','plp_site_content','plp_staff_identities'] loop
    execute format('alter table plp_runtime.%I enable row level security', t);
  end loop;
end $$;

revoke all on function plp_runtime.create_booking_atomic(jsonb) from public;
revoke all on function plp_runtime.confirm_booking_atomic(text) from public;
revoke all on function plp_runtime.create_paypal_payment_atomic(jsonb) from public;
revoke all on function plp_runtime.record_paypal_capture_atomic(jsonb) from public;
revoke all on function plp_runtime.enforce_reservation_inventory() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema plp_runtime to service_role;
    grant execute on function plp_runtime.create_booking_atomic(jsonb) to service_role;
    grant execute on function plp_runtime.confirm_booking_atomic(text) to service_role;
    grant execute on function plp_runtime.create_paypal_payment_atomic(jsonb) to service_role;
    grant execute on function plp_runtime.record_paypal_capture_atomic(jsonb) to service_role;
  end if;
end $$;
