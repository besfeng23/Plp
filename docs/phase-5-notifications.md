# Phase 5 Notification System

Phase 5 adds tracked guest/admin communication for the PLP reservation and payment flow.

## Required Vercel variables

```env
RESEND_API_KEY=
BOOKINGS_FROM_EMAIL=
BOOKINGS_TO_EMAIL=
```

Existing required variables from earlier phases still apply:

```env
NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app
XENDIT_SECRET_KEY=
XENDIT_WEBHOOK_TOKEN=
SUPABASE_URL=https://sxxpyyyaiylucgsylbhx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
PLP_STAFF_CODE=
```

## Database

New table:

```txt
plp_notifications
```

New view:

```txt
plp_notification_activity
```

The notification log stores:

- booking/payment relationship
- notification key
- recipient type
- recipient email
- channel
- subject
- status: PENDING / SENT / SKIPPED / FAILED
- provider message ID
- error
- payload
- sent timestamp

## Notification events

### Booking created

Triggered by:

```txt
POST /api/bookings
```

Recipients:

- Guest
- Admin

### Payment verified

Triggered by:

```txt
POST /api/xendit/webhook
```

Only fires when webhook verification passes and the payment status is successful.

Recipients:

- Guest
- Admin

### Payment exception

Triggered by:

```txt
POST /api/xendit/webhook
```

Fires when the webhook is unmatched or mismatched.

Recipient:

- Admin

### Booking status changed

Triggered by:

```txt
POST /api/admin/booking-status
```

Recipients:

- Guest
- Admin

## Admin visibility

The admin operations panel at `/admin-ops.html` now shows notification activity.

It also calls:

```txt
GET /api/admin/notifications
```

This endpoint requires the same staff code as the operations endpoints.

## Safety behavior

If Resend variables are not configured, notification attempts are logged as `SKIPPED` rather than pretending email was sent.

Duplicate notification keys are skipped to avoid repeat emails during webhook retries or staff refreshes.
