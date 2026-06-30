# OTA Conflict Audit Policy

## Model

Each saved operator decision should write a best-effort row to `plp_ota_conflict_resolution_events`.

## Required fields

- source table
- source id
- channel key when known
- conflict type
- previous status
- next status
- resolution type
- operator note
- actor
- event payload

## Best-effort logging

If the audit insert fails, the console may still save the review decision and return a warning. Operators should investigate migration and Supabase access if warnings persist.

## Access

No public or anonymous access is granted. RLS is enabled.

## Retention

Keep audit records for operational history and incident review.
