# PLP Admin Migration Runbook

This runbook lists the Supabase migrations required for the current PLP Resort Command admin and OTA review foundation.

All migrations in this chain are intended to be additive. Apply them in order and verify each step before using the dependent admin module in production.

## Required migration order

| Order | Migration | Enables | Dependent admin modules | If missing | Rollback note |
|---:|---|---|---|---|---|
| 1 | `20260630010000_admin_staff_tasks.sql` | Persisted staff tasks and internal notes. | Staff Tasks, Concierge Actions, Housekeeping Actions, worklog notes. | Staff task saves, internal notes, housekeeping/concierge action persistence, and task status updates can fail. | Additive table migration. Prefer disabling dependent UI actions before rollback. |
| 2 | `20260630020000_ota_sync_foundation.sql` | OTA channel, room mapping, sync event, and conflict foundation. | OTA Channel Readiness, OTA Dry Run foundation, later OTA planning modules. | OTA readiness and dry-run modules may show missing table errors or only static planning data. | Additive OTA foundation. Do not drop if later Phase 2 migrations are already applied. |
| 3 | `20260630030000_ota_sync_dry_run_events.sql` | OTA inventory dry-run event storage and conflict candidate logging. | Phase 2A OTA Inventory Dry Run, OTA conflict surfacing. | Dry-run plans may calculate but fail to persist run/conflict evidence. | Additive event/conflict storage. Keep rows for audit unless explicitly archived. |
| 4 | `20260630040000_ota_reservation_review_queue.sql` | OTA reservation import staging and review queue. | Phase 2B OTA Reservation Review Queue. | Staging, listing, review-status updates, and import summary cards can fail. | Additive import queue. Preserve raw payload audit history before rollback. |
| 5 | `20260630050000_ota_conflict_resolution_console.sql` | Operator conflict metadata, resolution events, and conflict summary view. | Phase 2C OTA Conflict Resolution Console. | Conflict resolution saves and summary panels can fail or become read-only. | Additive conflict metadata/events. Do not drop while unresolved conflict decisions are needed. |
| 6 | `20260630060000_ota_mapping_workspace.sql` | OTA room/rate mapping workspace, rate-plan mappings, and mapping audit events. | Phase 2D OTA Room & Rate Mapping Workspace. | Room/rate mapping saves, rate mapping lists, and audit writes can fail. | Additive mapping/audit tables. Keep approved mappings for future planning evidence. |
| 7 | `20260630070000_ota_preflight_readiness.sql` | OTA preflight runs, preflight check items, and latest summary view. | Phase 2E OTA Preflight & Operator Readiness Dashboard. | Preflight run persistence, latest run loading, and check item history can fail. | Additive preflight tables. Keep run history for go/no-go audit records. |

## Verification checklist

After applying migrations, open the staff-gated admin workspace and verify:

1. Staff Tasks loads without missing-table errors.
2. OTA Channel Readiness loads and remains planning-only.
3. OTA Dry Run loads and clearly states no live sync is enabled.
4. OTA Reservation Review Queue loads; staging a payload does not create a booking.
5. OTA Conflict Resolution Console loads; saving decisions does not mutate bookings/payments.
6. OTA Room & Rate Mapping Workspace loads; saving mappings does not connect to OTAs.
7. OTA Preflight Readiness loads; running preflight performs read-only checks only.

## Safety boundaries

These migrations do not authorize live OTA sync, guest messaging, booking creation, booking cancellation, payment mutation, PayPal changes, Xendit changes, or webhook changes.

Approved mapping or green preflight status means the system is ready for the next planning phase only. Live OTA connectivity requires a separate explicitly approved phase.

## Operational notes

- Apply migrations during a maintenance window if production staff are actively using `/admin`.
- Keep a database backup or restore point before applying the chain.
- If a migration fails, stop and resolve that migration before continuing to the next one.
- Do not skip migrations in the middle of the chain; later admin modules assume earlier tables/views may exist.
- If production `/admin` shows a migration-specific friendly error, apply the named migration before debugging application code.
