# OTA Reservation Import Schema

## Raw payload shape
```json
{
  "channelKey": "agoda",
  "otaReservationReference": "AGD-123",
  "guestName": "Guest Name",
  "guestEmail": "guest@example.com",
  "guestPhone": "+63...",
  "accommodationName": "Grand Ocean Villa",
  "otaRoomId": "room-1",
  "otaRoomName": "Villa",
  "otaRatePlanId": "rate-1",
  "checkIn": "2026-08-01",
  "checkOut": "2026-08-04",
  "guests": 2,
  "currency": "PHP",
  "totalAmount": 100000,
  "depositAmount": 0,
  "paymentState": "paid_to_ota",
  "rawPayload": {}
}
```

## Normalized payload shape
Normalized fields use camelCase in the API module and snake_case in `plp_ota_reservation_imports`. Raw payloads are preserved in `raw_payload`; normalized values and validation metadata are preserved in `normalized_payload`.

## Alternate field names supported
`reservation_id`, `booking_id`, `confirmation_code`, `guest_name`, `email`, `phone`, `room_name`, `room_id`, `rate_plan_id`, `arrival_date`, `departure_date`, `check_in`, `check_out`, `total`, `amount`, `currency_code`, and `payment_status`.

## Validation rules
- `channelKey` defaults to `unknown` when absent.
- OTA reservation reference is required.
- `checkIn` and `checkOut` must be `YYYY-MM-DD`.
- Check-out must be after check-in.
- Stay length must not exceed 90 days.
- Known accommodations are Grand Ocean Villa, Sunset Suite, and Smart Room Premium.
- Guests must be an integer at least 1 when present.
- Amounts must be numeric when present.
- Currency defaults to PHP only when missing; raw currency is preserved.

## Review statuses
`needs_review`, `in_review`, `rejected`, `approved_for_manual_entry`, `archived`.

## Conflict statuses
`unchecked`, `no_conflict`, `conflict_detected`, `blocked`, `duplicate`, `invalid`.

## Severity model
Critical means protected direct booking conflict. High means manual block, duplicate, or invalid accommodation. Medium means missing mapping or payment ambiguity. Low means optional contact gaps.

## Payment state mapping
Allowed values are `unknown`, `unpaid`, `paid_to_ota`, `collect_at_property`, `partially_paid`, `cancelled`, and `refunded`. Payment state never mutates PLP payment records.

## Examples
### Agoda staged import
Use `channelKey: "agoda"`, a reference, dates, accommodation, room/rate plan IDs, and raw Agoda fields in `rawPayload`.

### Airbnb staged import
Use `channelKey: "airbnb"`, listing-derived room data, guest contact fields when available, and `paymentState: "collect_at_property"` or `unknown` if unclear.

### Booking.com staged import
Use `channelKey: "booking_com"`, `confirmation_code`, `arrival_date`, and `departure_date`; these normalize to the Phase 2B fields.

### Duplicate import
A second row with the same `channel_key` and `ota_reservation_reference` is blocked by the unique constraint and reported as duplicate; no booking is created.

### Manual block conflict
A staged OTA date range overlapping `plp_active_blocked_dates` is high severity, or critical if a direct hold also overlaps.
