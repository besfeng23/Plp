# Admin Phase 1L — Availability Block / Write Controls

## Summary

Phase 1L adds admin-only manual availability block controls to PLP Resort Command. Staff can create and cancel manual date blocks using the existing admin date-block backend.

## Admin-only safety

This phase does not change public booking UI, booking prices, booking creation, PayPal, Xendit, webhook verification, OTA integrations, or public luxury pages.

## Backend used

Existing admin endpoint:

```text
GET   /api/admin?action=date-blocks
POST  /api/admin?action=date-blocks
PATCH /api/admin?action=date-blocks
```

The backend writes to the existing blocked-date flow and rejects blocks that overlap active bookings.

## UI behavior

A new Availability Block Controls panel is loaded after the admin action chain. Staff can choose an accommodation, start date, end date, and reason, then create a manual block. Active manual blocks returned by the admin API are listed with a cancel action.

## Staff worklog

The UI makes a best-effort staff-task worklog entry when a block is created or cancelled, using category `availability`. If the Phase 1I staff-task table has not been migrated yet, the block action can still succeed and the worklog attempt is ignored.

## Persistence boundary

This phase creates and cancels manual date blocks only. It does not alter booking prices, payment state, booking creation, OTA sync, guest messages, or public booking page behavior.
