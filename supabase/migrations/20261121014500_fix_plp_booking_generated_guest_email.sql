-- PLP production booking hotfix, 2026-11-21.
-- Verified at 2026-11-21T01:28:49Z: Postgres SQLSTATE 428C9 on booking RPC.
-- plp_runtime.plp_guests.normalized_email is GENERATED ALWAYS AS (lower(btrim(email))) STORED.
-- Do not explicitly supply this generated column in the guest INSERT.
-- Keep conflict handling on its existing unique index, atomic booking validation,
-- lock behavior, 30% deposit computation, RPC interface, and SECURITY INVOKER semantics.
-- CREATE OR REPLACE retains the existing function owner and privileges.

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
$function$
