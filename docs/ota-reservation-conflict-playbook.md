# OTA Reservation Conflict Playbook

## Conflict types
- Direct booking overlap
- Manual block overlap
- Duplicate OTA reference
- Missing room mapping
- Invalid accommodation
- Payment ambiguity
- Optional guest contact incomplete

## Severity levels
- Critical: active direct booking overlap, especially with manual block overlap.
- High: manual block overlap, duplicate import, invalid accommodation.
- Medium: missing room mapping or ambiguous OTA payment state.
- Low: missing optional guest email or phone.

## Examples
### Direct booking overlap
An Agoda villa payload overlaps a protected direct website hold. Required decision: operator review. Never auto-cancel or downgrade the direct booking.

### Manual block overlap
An Airbnb import overlaps blocked dates. Required decision: confirm whether the block is still valid. Never auto-resolve.

### Duplicate OTA reference
A Booking.com confirmation is staged twice. Required decision: keep the original staged record and reject/archive the duplicate as appropriate.

### Missing room mapping
An Expedia room ID is not mapped to Grand Ocean Villa, Sunset Suite, or Smart Room Premium. Required decision: update mapping in a future safe workflow before manual entry.

### Invalid accommodation
The OTA accommodation name does not match known PLP names. Required decision: human identification or rejection.

### Payment ambiguity
OTA says paid to OTA or collect at property. Required decision: finance review. Never mutate PLP payment status.

## Required human decisions
Operators decide whether to manually enter, reject, archive, or escalate each import after comparing protected records.

## What must never be auto-resolved
Direct booking conflicts, manual block conflicts, duplicate references, payment ambiguity, and invalid accommodation names must never be resolved by automatic booking/payment changes.
