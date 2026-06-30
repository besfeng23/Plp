# Admin Phase 1K — Housekeeping Status Actions

## Summary

Phase 1K connects Housekeeping Readiness to the persisted staff-task backend introduced in Phase 1I. Staff can save housekeeping status worklog entries from derived readiness cards.

## Admin-only safety

This phase does not change public booking UI, booking prices, booking creation, PayPal, Xendit, webhook verification, OTA integrations, or public luxury pages.

## Backend used

This phase uses the existing Phase 1I endpoint:

```text
POST /api/admin?action=staff-task
```

The action writes housekeeping worklog entries into:

```text
plp_staff_tasks
```

## UI behavior

A new Housekeeping Status Actions panel is loaded after the persisted staff-task/concierge action chain. It reads `window.plpHousekeepingReadiness`, lets staff choose a derived housekeeping item, previews guest/stay/room context, and saves a housekeeping status entry as a real staff task.

## Status actions

- dirty
- inspecting
- ready
- blocked

## Persistence boundary

This phase saves housekeeping status worklog entries as staff tasks only. It does not yet create a dedicated room-status table, block availability, alter booking status, change payment state, or expose anything publicly.
