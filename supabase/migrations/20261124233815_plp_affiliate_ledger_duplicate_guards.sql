-- Provider-applied migration 20261124233815, dedicated PLP runtime.
-- Prevent duplicate booking commissions and repeated recorded payout references.
create unique index if not exists plp_commissions_booking_affiliate_type_uidx
on plp_runtime.plp_commissions (booking_id, affiliate_id, commission_type)
where booking_id is not null;
create unique index if not exists plp_payouts_recorded_reference_uidx
on plp_runtime.plp_payouts (affiliate_id, currency, lower(btrim(payout_reference)))
where status = 'recorded' and nullif(btrim(payout_reference),'') is not null;
