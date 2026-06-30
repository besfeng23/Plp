# OTA Conflict Policy

## Conflict types
- `manual_block_overlaps_booking`
- `duplicate_mapping`
- `mapping_missing_ota_room`
- `mapping_missing_rate_plan`
- `channel_disabled`
- `channel_credentials_missing`
- `date_range_invalid`
- `accommodation_unmapped`

## Severity levels
- Critical: manual block overlaps an active direct booking.
- High: duplicate mapping or missing OTA room/rate while sync is enabled.
- Medium: disabled channel or missing credentials.
- Low: planning-only warnings.

## Review rules
Every open conflict requires human review before any future live OTA action.

## Who can resolve
Only authorized Resort Command staff with admin access should resolve conflicts.

## What must never be auto-resolved
Direct booking overlaps, OTA reservation disputes, payment-dependent status questions, and guest-impacting cancellations must never be auto-resolved.

## Direct booking protection
Direct bookings remain protected source records. They must not be auto-cancelled by OTA sync.

## Manual block protection
Manual admin blocks close availability in dry-run planning and must be reviewed if they overlap direct holds.

## OTA reservation import future policy
Future OTA reservations should enter a review queue first with no auto-confirmation.

## Incident response
If a conflict suggests oversell risk, pause any future approval workflow, preserve raw records, notify operations, and document resolution notes.
