# Admin Phase 1H — Housekeeping Readiness V1

## Summary

Housekeeping Readiness V1 adds a read-only turnover and stayover readiness layer to PLP Resort Command. It derives housekeeping attention cards from already-loaded reservation dates.

## Admin-only safety

This phase does not change public booking UI, booking prices, booking creation, PayPal, Xendit, webhook verification, OTA integrations, or public luxury pages.

## Data source

The readiness layer uses only rows already returned to `/admin` from the existing operations load. It does not create, update, or delete room status records.

## Derived readiness labels

Cards can be derived for same-day turnover, checkout turnover, arrival prep today, upcoming prep, and in-house refresh checks.

## Visible fields

Each card can show room/villa, guest, stay dates, booking reference, derived readiness label, priority, and a View Reservation 360 action.

## Persistence boundary

This phase is read-only. It does not save dirty, inspect, ready, assigned, completed, blocked, or room-ready status. Those belong in later phases with backend schema, audit trails, and reviewed permissions.
