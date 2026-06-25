# PLP Phase 14 Full Dynamic Content Integration

Phase 14 upgrades public content hydration from loose text matching to explicit content-key binding.

## Purpose

Staff-published content should update public pages predictably.

Instead of relying only on matching existing text, public pages can now mark exact content fields with attributes such as:

- `data-content-key`
- `data-content-money`
- `data-content-template`
- `data-content-list`

## Implemented files

- `/public/content-hydrate.js`
- `/public/accommodation.html`
- `/public/experiences.html`
- `/docs/plp-phase-14-dynamic-content-schema.sql`

## Hydrator upgrades

The public hydrator now supports:

### Text values

`data-content-key="accommodation.grandOceanVilla.name"`

### Peso money values

`data-content-money="accommodation.grandOceanVilla.rate"`

### Template values

`data-content-key="accommodation.grandOceanVilla.capacity" data-content-template="Up to {{value}}"`

### Dynamic lists

`data-content-list="experiences.waterItems"`

Lists can come from JSON arrays or pipe-separated text.

## Accommodation page integration

Accommodation fields are now explicitly bound for:

- room name
- room type
- room description
- capacity
- bedrooms
- starting rate
- short best-for label
- long best-for copy
- concierge arrangement list

Supported rooms:

- Grand Ocean Villa
- Sunset Suite
- Smart Room Premium

## Experiences page integration

Experience sections are now explicitly bound for:

- water copy
- water arrangement list
- wellness copy
- wellness arrangement list
- private dining copy
- private dining arrangement list

## Schema update

A Phase 14 SQL file was added:

`docs/plp-phase-14-dynamic-content-schema.sql`

This upserts richer JSON content for:

- homepage
- accommodation
- experiences
- policies

## Safety model

Pages still have hardcoded defaults.

If `/api/content` fails, or if staff content is missing, public pages continue to render safely.

## Remaining work

The main React homepage can be made cleaner in a future refactor by moving public copy into structured React components with native content keys instead of post-render hydration.

For now, the static public conversion pages and booking path have the strongest explicit content binding.
