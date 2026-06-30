# OTA Preflight Checklist

## Database readiness checklist
- Phase 1N OTA foundation tables/views are present.
- Phase 2B reservation review storage is present.
- Phase 2C conflict resolution events are present.
- Phase 2D room and rate mapping tables are present.

## Channel readiness checklist
- Agoda, Airbnb, Expedia, Booking.com, Direct Website, Google Hotel Ads, and Trip.com appear in planning or mapping data.
- No channel has live-mode flags enabled.
- No channel stores credential-shaped fields.
- Status remains planning/review-only.

## Room mapping checklist
- Grand Ocean Villa has active mapping coverage.
- Sunset Suite has active mapping coverage.
- Smart Room Premium has active mapping coverage.
- Approved mappings include OTA room identifier or name evidence.
- Archived or blocked mappings are excluded from readiness scoring.

## Rate mapping checklist
- Approved room mappings have at least one rate mapping.
- Approved rate mappings include OTA rate ID, name, or code.
- Currency is PHP unless separately documented.
- Minimum and maximum night values are possible.

## Reservation review checklist
- OTA reservation imports table exists.
- Needs-review queue is visible.
- Critical/high unresolved imports are cleared.
- Duplicate and invalid imports are handled.

## Conflict resolution checklist
- Open critical conflicts are cleared.
- Open high conflicts are cleared.
- Waiting-on-staff conflicts are assigned and visible.
- Resolution/audit history exists for handled conflicts.

## Manual block protection checklist
- Active manual block source exists.
- Manual block conflicts are surfaced to operators.
- Preflight makes no changes to manual blocks.

## Direct booking protection checklist
- Active booking hold source exists.
- Direct-booking overlap conflicts are surfaced as critical.
- Preflight makes no booking changes.

## Staff task readiness checklist
- Staff task table is available.
- Open high-priority OTA/admin tasks are reviewed.
- Stale open tasks are closed or re-assigned.

## Security checklist
- Staff-code route protection remains required.
- No OTA credentials are present in mapping/planning rows.
- No live-mode flags are enabled.
- No public/anonymous access is assumed by the admin UI.

## Deployment checklist
- Phase 2E migration is applied.
- Admin API endpoints respond behind staff code.
- Admin UI loads after the mapping workspace.
- Live route verification is completed separately after deployment.
