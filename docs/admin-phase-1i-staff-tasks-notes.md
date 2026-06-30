# Admin Phase 1I — Persisted Internal Notes + Staff Tasks

## Summary

Phase 1I adds the first persisted admin worklog layer to PLP Resort Command. Staff can save internal notes and operational tasks against a booking reference through the admin API.

## Admin-only safety

This phase does not change public booking UI, booking prices, booking creation, PayPal, Xendit, webhook verification, OTA integrations, or public luxury pages.

## Backend

New admin actions:

- `GET /api/admin?action=staff-tasks`
- `GET /api/admin?action=staff-tasks&reference=<booking_reference>`
- `POST /api/admin?action=staff-task`
- `PATCH /api/admin?action=staff-task`

All requests still require the existing staff access header.

## Schema

Migration file:

```text
supabase/migrations/20260630010000_admin_staff_tasks.sql
```

Table:

```text
plp_staff_tasks
```

Fields include booking reference, kind, category, priority, status, title, note, actor, source, created_at, updated_at, and completed_at.

## Supported values

Kind:

- task
- note

Category:

- concierge
- housekeeping
- payment
- arrival
- availability
- admin

Priority:

- high
- medium
- normal

Status:

- open
- in_progress
- done
- cancelled

## UI

The admin staff task panel loads after Housekeeping Readiness. It can save a task or note for a loaded booking reference and update task status.

## Persistence boundary

This phase persists tasks and notes only. It does not yet persist room readiness, concierge completion workflows, availability block decisions, or staff assignments beyond the actor text saved with the task row.
