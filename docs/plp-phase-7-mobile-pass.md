# PLP Phase 7 Mobile-First Luxury Pass

Phase 7 focuses on making the public site feel calm, readable, and easy to use on mobile.

## Objective

The mobile experience should feel deliberate, not like a desktop page squeezed into a phone.

## Implemented global rules

The global stylesheet now includes:

- safer tap highlighting
- larger minimum tap targets
- 16px form inputs to reduce unwanted iOS zooming
- safe-area support for bottom fixed actions
- reduced letter spacing on narrow screens
- tighter mobile type scaling for large headings
- better mobile spacing rhythm
- overflow protection for headings and paragraphs

## Mobile standards

Navigation:

- logo remains readable
- header does not feel crowded
- Reserve, Email, and Concierge remain easy to access

Homepage:

- hero should not feel like empty vertical dead space
- calls to action should be easy to tap
- visual blocks should crop intentionally

Accommodation:

- room sections stack clearly
- image appears before deep details
- rate, guest count, and best-for logic appear before the action
- request-date actions are easy to tap

Experiences:

- experience categories stay short and scannable
- water, wellness, dining, and arrival support remain clear

Booking:

- room cards are easy to tap
- date fields are large enough
- summary remains understandable
- flow moves from stay to dates to guest to review
- concierge fallback remains visible

Trust pages:

- policy text remains readable
- footer links do not crowd

## Acceptance criteria

Phase 7 is complete when:

- buttons and links are at least 44px tall on mobile
- form inputs are at least 46px tall
- large headings do not overflow on iPhone widths
- mobile sections do not create accidental huge gaps
- bottom sticky actions respect safe areas
- booking can be completed comfortably on mobile
- policy pages remain readable without zooming

## Manual QA still recommended

Check on:

- iPhone Safari
- iPhone Chrome
- Android Chrome
- 390px viewport
- 430px viewport

Test:

- homepage scroll
- accommodation page readability
- experiences page scan
- booking form completion
- policy page readability
- footer links
- bottom action behavior
