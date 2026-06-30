# Admin Phase 1J — Concierge Task Backend Wiring

## Summary

Phase 1J connects the derived Concierge Queue to the persisted staff-task backend introduced in Phase 1I. Staff can take a derived concierge queue item and save it as a real staff task.

## Admin-only safety

This phase does not change public booking UI, booking prices, booking creation, PayPal, Xendit, webhook verification, OTA integrations, or public luxury pages.

## Backend used

This phase uses the existing Phase 1I endpoint:

```text
POST /api/admin?action=staff-task
```

The action writes into:

```text
plp_staff_tasks
```

## UI behavior

A new Concierge Task Actions panel is loaded after the persisted staff-task panel. It reads `window.plpConciergeQueue`, lets staff choose a derived concierge item, previews the guest/stay/room context, and saves the selected item into the persisted staff-task worklog.

## Category mapping

- Arriving Soon → arrival
- Follow-up → payment
- All other concierge queue categories → concierge

## Priority mapping

- High → high
- Medium → medium
- Normal → normal

## Persistence boundary

This phase saves selected concierge queue items as staff tasks only. It does not mark concierge work complete, assign staff owners, send messages to guests, change booking status, change payment state, or alter availability.
