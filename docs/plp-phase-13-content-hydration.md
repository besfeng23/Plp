# PLP Phase 13 Public Content Hydration

Phase 13 connects the content management foundation to the public website.

## Purpose

Staff should be able to publish selected site content without requiring a code edit for every rate, room detail, policy note, or experience text change.

The public pages still keep hardcoded luxury defaults, but now hydrate from `/api/content` when published content exists.

## Implemented files

- `/public/content-hydrate.js`
- updated `/index.html`
- updated `/public/booking.html`
- updated `/public/accommodation.html`
- updated `/public/experiences.html`

## Hydration behavior

The hydrator fetches:

`GET /api/content`

Then it applies content to supported public pages.

Supported sections:

- homepage
- accommodation
- experiences
- policies

## Main app shell

The main app shell now loads:

`/content-hydrate.js`

This lets homepage copy hydrate after React renders.

## Booking page hydration

The booking page now exposes:

`window.plpApplyBookingContent(content)`

This lets staff-published content update:

- room names
- room rates
- room capacity
- bedroom counts
- reservation policy note

Booking calculations then update using the hydrated rates.

## Accommodation page hydration

The accommodation page now loads the content hydrator.

Hydration can adjust supported public room-rate and room-detail text from published content.

## Experiences page hydration

The experiences page now loads the content hydrator.

Hydration can adjust supported experience copy for:

- water
- wellness
- private dining

## Safety model

If `/api/content` fails or the content table is not ready, the public pages keep their hardcoded defaults.

This prevents broken pages while allowing staff-managed content when the database is ready.

## Required setup

Before staff updates appear publicly, run:

`docs/plp-phase-12-content-management.sql`

Then publish content through:

`/content-ops.html`

## Remaining improvements

Future integration can make every public page fully data-driven with explicit `data-content-key` attributes and shared components.

This phase intentionally uses safe progressive hydration rather than a risky full rewrite.
