# OTA Room & Rate Mapping Guide

## Agoda room IDs
Use Agoda extranet room identifiers when available. Enter the Agoda room ID, room name, property ID, and any channel room code visible to staff. If the ID is not visible, save a draft with the room name and mark it `needs_review`.

## Airbnb listing IDs
Airbnb commonly centers mapping around listing IDs. Store the listing ID in OTA listing ID and include the listing title as the room name. Do not store host credentials, tokens, or login hints.

## Expedia room/rate plan IDs
Expedia mappings should capture the Expedia room ID and rate plan ID when staff can verify them from Expedia Partner Central exports or reports. Keep ambiguous rate plans in draft until a second operator confirms them.

## Booking.com room/rate plan IDs
Booking.com room and rate-plan identifiers should be copied from official channel exports or the partner admin. Record both ID and human-readable room/rate names to reduce accidental mismatches.

## Direct Website mapping
Use `direct_website` only as an internal reference for PLP-controlled inventory naming. It does not change direct booking prices or public booking behavior.

## Google Hotel Ads mapping
Google Hotel Ads mappings should reference the partner room/rate identifiers used by the future feed or integration plan. Approval here does not publish a feed.

## Trip.com mapping
Trip.com room and rate IDs should be recorded from Trip.com partner tooling or verified exports. If Trip.com displays only names, save the names and mark the mapping for review.

## When channel data is incomplete
- Save a draft only if at least one accepted OTA identifier or name exists.
- Use notes to describe what is missing.
- Do not paste credentials, passwords, API keys, tokens, or private login instructions.
- Leave approval until staff can verify the source data.

## Why approved mapping is not live sync
Approved means the mapping is suitable for future operator use. It does not enable OTA sync, push inventory, update prices, create/cancel bookings, or contact guests.
