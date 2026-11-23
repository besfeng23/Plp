-- Behaviour checks for the PLP booking baseline. Run ONLY against a disposable database
-- (scripts/verify-booking-baseline.sh refuses Supabase-hosted URLs). Everything runs in one
-- transaction that is rolled back at the end.
\set ON_ERROR_STOP on
begin;
set local role postgres;

insert into plp_runtime.plp_accommodations(name, nightly_rate_php, capacity, bedrooms)
values ('Test Villa', 1000, 4, 2);

-- 1. A valid hold is created with a 1-hour expiry and the server price rules.
do $$
declare r jsonb;
begin
  r := plp_runtime.create_booking_atomic(jsonb_build_object(
    'reference','PLP-T1','email','Guest@Example.com','name','Test Guest','phone','1',
    'accommodation','Test Villa','checkIn','2030-01-10','checkOut','2030-01-13',
    'guests',2,'nights',3,'rate',1000,'amount',3000,'deposit',900,'balance',2100));
  assert r->>'status' = 'PENDING_PAYMENT', 'hold status';
  assert (select expires_at > now() + interval '55 minutes' from plp_runtime.plp_bookings where booking_reference='PLP-T1'), 'hold expiry';
  assert (select normalized_email from plp_runtime.plp_guests limit 1) = 'guest@example.com', 'generated email';
end $$;

-- 2. Wrong price, wrong deposit, over capacity and mismatched nights are rejected.
do $$
declare bad jsonb[] := array[
  '{"rate":900,"amount":2700,"deposit":810,"balance":1890,"guests":2,"nights":3}'::jsonb,
  '{"rate":1000,"amount":3000,"deposit":500,"balance":2500,"guests":2,"nights":3}'::jsonb,
  '{"rate":1000,"amount":3000,"deposit":900,"balance":2100,"guests":9,"nights":3}'::jsonb,
  '{"rate":1000,"amount":2000,"deposit":600,"balance":1400,"guests":2,"nights":2}'::jsonb];
  b jsonb; failed int := 0;
begin
  foreach b in array bad loop
    begin
      perform plp_runtime.create_booking_atomic(b || jsonb_build_object('reference','PLP-BAD'||failed,'email','x@example.com',
        'accommodation','Test Villa','checkIn','2030-02-10','checkOut','2030-02-13'));
    exception when invalid_parameter_value then failed := failed + 1;
    end;
  end loop;
  assert failed = 4, 'all invalid quotes rejected, got ' || failed;
end $$;

-- 3. Overlapping hold is refused; adjacent stay (check-out day = check-in day) is allowed.
do $$
declare ok boolean := false;
begin
  begin
    perform plp_runtime.create_booking_atomic(jsonb_build_object('reference','PLP-T2','email','b@example.com',
      'accommodation','Test Villa','checkIn','2030-01-12','checkOut','2030-01-14',
      'guests',2,'nights',2,'rate',1000,'amount',2000,'deposit',600,'balance',1400));
  exception when exclusion_violation then ok := true;
  end;
  assert ok, 'overlap must be refused';
  perform plp_runtime.create_booking_atomic(jsonb_build_object('reference','PLP-T3','email','c@example.com',
    'accommodation','Test Villa','checkIn','2030-01-13','checkOut','2030-01-15',
    'guests',2,'nights',2,'rate',1000,'amount',2000,'deposit',600,'balance',1400));
end $$;

-- 4. An expired hold no longer blocks the dates.
update plp_runtime.plp_bookings set expires_at = now() - interval '1 minute' where booking_reference = 'PLP-T3';
do $$
begin
  perform plp_runtime.create_booking_atomic(jsonb_build_object('reference','PLP-T4','email','d@example.com',
    'accommodation','Test Villa','checkIn','2030-01-13','checkOut','2030-01-15',
    'guests',2,'nights',2,'rate',1000,'amount',2000,'deposit',600,'balance',1400));
end $$;

-- 5. A date block cannot overlap an active hold, and bookings cannot overlap a block.
do $$
declare ok boolean := false; aid uuid := (select id from plp_runtime.plp_accommodations where name='Test Villa');
begin
  begin
    insert into plp_runtime.plp_blocked_dates(accommodation_id,start_date,end_date) values (aid,'2030-01-11','2030-01-12');
  exception when exclusion_violation then ok := true; end;
  assert ok, 'block over hold refused';
  insert into plp_runtime.plp_blocked_dates(accommodation_id,start_date,end_date) values (aid,'2030-03-01','2030-03-05');
  ok := false;
  begin
    perform plp_runtime.create_booking_atomic(jsonb_build_object('reference','PLP-T5','email','e@example.com',
      'accommodation','Test Villa','checkIn','2030-03-03','checkOut','2030-03-06',
      'guests',2,'nights',3,'rate',1000,'amount',3000,'deposit',900,'balance',2100));
  exception when exclusion_violation then ok := true; end;
  assert ok, 'booking over block refused';
end $$;

-- 6. Payment: checkout must match the stored deposit; capture is verified once; then confirm.
do $$
declare r jsonb; ok boolean := false;
begin
  begin
    perform plp_runtime.create_paypal_payment_atomic('{"bookingReference":"PLP-T1","providerSessionId":"ORDER1","checkoutUrl":"https://example.test/pay","amount":"100","currency":"PHP"}');
  exception when invalid_parameter_value then ok := true; end;
  assert ok, 'wrong checkout amount refused';
  perform plp_runtime.create_paypal_payment_atomic('{"bookingReference":"PLP-T1","providerSessionId":"ORDER1","checkoutUrl":"https://example.test/pay","amount":"900","currency":"PHP"}');
  assert (select status from plp_runtime.plp_bookings where booking_reference='PLP-T1') = 'PAYMENT_PROCESSING', 'processing';
  assert (plp_runtime.confirm_booking_atomic('PLP-T1')->>'ok')::boolean = false, 'cannot confirm before capture';
  r := plp_runtime.record_paypal_capture_atomic('{"bookingReference":"PLP-T1","orderId":"ORDER1","captureId":"CAP1","amount":"800","currency":"PHP","status":"COMPLETED"}');
  assert r->>'verificationStatus' = 'AMOUNT_MISMATCH', 'short capture flagged';
  assert (select count(*) from plp_runtime.plp_payment_exceptions) = 1, 'exception visible';
  r := plp_runtime.record_paypal_capture_atomic('{"bookingReference":"PLP-T1","orderId":"ORDER1","captureId":"CAP2","amount":"900","currency":"PHP","status":"COMPLETED"}');
  assert r->>'verificationStatus' = 'VERIFIED', 'capture verified';
  r := plp_runtime.record_paypal_capture_atomic('{"bookingReference":"PLP-T1","orderId":"ORDER1","captureId":"CAP2","amount":"900","currency":"PHP","status":"COMPLETED"}');
  assert r->>'verificationStatus' = 'DUPLICATE', 'replay ignored';
  assert (plp_runtime.confirm_booking_atomic('PLP-T1')->>'ok')::boolean, 'confirm after verified capture';
  assert (select status from plp_runtime.plp_bookings where booking_reference='PLP-T1') = 'CONFIRMED', 'confirmed';
  assert (select count(*) from plp_runtime.plp_availability_calendar where source_type='booking') >= 2, 'calendar view';
  assert (select payment_verification_status from plp_runtime.plp_payment_reconciliation where booking_reference='PLP-T1') = 'VERIFIED', 'reconciliation view';
end $$;

-- 7. Grants: browser roles have no access; the server role does.
do $$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    assert not has_table_privilege('anon','plp_runtime.plp_bookings','select'), 'anon cannot read bookings';
    assert not has_table_privilege('authenticated','plp_runtime.plp_payments','select'), 'authenticated cannot read payments';
    assert not has_function_privilege('anon','plp_runtime.create_booking_atomic(jsonb)','execute'), 'anon cannot call booking rpc';
    assert has_table_privilege('service_role','plp_runtime.plp_bookings','insert'), 'service role writes bookings';
    assert not has_table_privilege('service_role','plp_runtime.plp_staff_identities','insert'), 'staff identities read-only';
    assert has_function_privilege('service_role','plp_runtime.create_booking_atomic(jsonb)','execute'), 'service role calls rpc';
  end if;
  assert (select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='plp_runtime' and c.relkind='r' and c.relname like 'plp_%'), 'RLS on every table';
end $$;

rollback;
\echo 'booking baseline checks passed'
