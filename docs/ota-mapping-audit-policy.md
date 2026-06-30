# OTA Mapping Audit Policy

## Audit event fields
Audit events record mapping table, mapping ID, channel, internal accommodation, previous status when available, next status, action type, operator note, actor, payload, and creation time.

## Best-effort logging behavior
The admin save path attempts to write an audit event after each create, update, or archive. If audit logging fails, the mapping save still succeeds and the API returns a warning.

## Operator identity
Operator identity comes from the staff name header when present and otherwise falls back to `staff`. Staff-code protection remains required for the admin API.

## Notes policy
Notes should explain mapping evidence, uncertainty, and review decisions. Notes must not include OTA credentials, passwords, API keys, tokens, client secrets, or private account recovery information.

## No credentials in notes
Credential-like fields are rejected by the admin guard, and operators must not paste secrets into notes or IDs.

## No public access
The migration enables RLS on new tables and does not add public-readable policies.

## No anon policies
Phase 2D does not grant anonymous access and does not add anon RLS policies.

## Retention recommendation
Retain mapping audit events for at least one year, or longer if OTA integration planning requires a complete change history.
