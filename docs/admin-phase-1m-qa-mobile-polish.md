# Admin Phase 1M — QA / Mobile Polish / Deploy Cleanup

## Summary

Phase 1M adds a lightweight admin QA and mobile polish layer to PLP Resort Command. It checks whether the major admin modules are loaded, adds mobile-safe admin styling, improves empty-state styling, and gives clearer operator-facing messages when supporting tables or environment configuration are missing.

## Admin-only safety

This phase does not change public booking UI, booking prices, booking creation, PayPal, Xendit, webhook verification, OTA integrations, or public luxury pages.

## What changed

- Added `public/admin-qa-polish.js`
- Loaded the QA layer from `admin.html` after the Availability Board script is appended
- Added a QA panel that checks module availability for Reservation 360, Confirmation Workflow, Guest Profile 360, Concierge Queue, Availability Board, Housekeeping Readiness, Staff Tasks, Concierge Actions, Housekeeping Actions, and Availability Blocks
- Added mobile-safe section/button/input polish
- Added clearer messaging for missing Phase 1I staff-task migration, availability block storage warnings, and Supabase environment issues

## Deploy gates

Before expecting this to work live:

1. Clear Vercel build-rate-limit.
2. Redeploy latest `main`.
3. Apply the Phase 1I Supabase migration:

```text
supabase/migrations/20260630010000_admin_staff_tasks.sql
```

## Persistence boundary

This phase is a QA/polish layer only. It does not create, update, or delete bookings, payments, blocked dates, housekeeping rows, or guest records.
