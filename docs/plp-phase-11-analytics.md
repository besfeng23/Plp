# PLP Phase 11 Analytics and Conversion Tracking

Phase 11 adds first-party guest journey analytics for the PLP website.

## Purpose

The goal is to understand conversion behavior without collecting unnecessary personal data.

PLP should be able to answer:

- Which pages get viewed?
- Which reservation CTAs are clicked?
- Which rooms are selected?
- Which dates are checked?
- Which availability checks pass or fail?
- How many users submit reservation requests?
- How many booking references are created?
- How many users reach checkout?
- How often guests choose email or concierge fallback?

## Implemented files

- `/public/analytics.js`
- `/api/analytics.js`
- updated `/index.html`
- updated `/public/booking.html`
- `/docs/plp-phase-11-analytics.sql`

## Tracked events

The analytics endpoint accepts only allowlisted events:

- view_page
- click_reserve
- click_email
- click_concierge
- view_booking
- select_room
- select_dates
- check_availability
- availability_result
- submit_booking
- booking_created
- start_checkout
- checkout_error
- payment_return_success
- payment_return_cancel
- view_accommodation
- view_experiences
- view_seo_page

## Privacy rules

The analytics endpoint strips sensitive fields such as:

- name
- email
- phone
- message
- specialRequests

The tracker is first-party and posts only to `/api/analytics`.

## Storage behavior

If Supabase is configured and the `plp_analytics_events` table exists, events are stored.

If the table does not exist, the endpoint returns success with `stored: false` so the guest experience does not break.

## Required database step

Run the SQL in:

`docs/plp-phase-11-analytics.sql`

This creates:

- `public.plp_analytics_events`
- event name index
- page path index
- created-at index
- RLS enabled

## Next analytics improvements

Future work can add:

- staff analytics dashboard
- funnel reporting
- booking drop-off report
- room interest report
- email-vs-form preference report
- campaign source tracking
