# Phase 4 Admin Operations

Phase 4 adds a live operations screen for Pueblo La Perla staff.

## Location

Open:

```txt
/admin-ops.html
```

## Required Vercel variable

```env
PLP_STAFF_CODE=
```

The panel also still needs the Phase 1 to 3 variables:

```env
NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app
XENDIT_SECRET_KEY=
XENDIT_WEBHOOK_TOKEN=
SUPABASE_URL=https://sxxpyyyaiylucgsylbhx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
```

## Operations available

- Load live Supabase booking/payment reconciliation rows.
- Show payment exceptions.
- Confirm booking after verified deposit payment.
- Put booking back into payment review.
- Cancel booking.

## Endpoints

```txt
GET /api/admin/operations
POST /api/admin/booking-status
```

Both endpoints require the staff code sent by the admin panel.
