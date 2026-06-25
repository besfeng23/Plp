# PLP production audit fixes

Implemented after the live site audit.

## Done

- Homepage now preloads the current sunset hero image instead of the older villa-close aerial.
- Homepage Open Graph and Twitter preview now use the real sunset hero image instead of the SVG preview.
- Homepage loads `/image-placement.css` in the document head for earlier image styling.
- Hero CSS now targets the actual React background layer and hides the old text placeholder.
- Static public pages now receive a mobile action bar with Reserve, Email, and Concierge links.
- Static public pages now receive a trust strip for location, private reservation review, transfer support, and concierge email.
- The booking page now receives an assurance block explaining that the form creates a reservation request first and final confirmation follows PLP review.

## Still pending for a later binary asset pass

The connector used for these edits updates text files. It does not convert or upload binary image files. The selected PNG photos should later be converted into optimized WebP or AVIF files and renamed with semantic production filenames.

Recommended production image names include:

- `plp-hero-sunset.webp`
- `plp-grand-villa-exterior.webp`
- `plp-pool-ocean-view.webp`
- `plp-master-bedroom-view.webp`
- `plp-sunset-balcony.webp`
- `plp-day-balcony-sea-view.webp`
- `plp-rooftop-evening-lounge.webp`
- `plp-smart-room-twin-view.webp`
- `plp-bedroom-balcony-outlook.webp`
- `plp-bathroom-vanity-shower.webp`
- `plp-poolside-experience.webp`
- `plp-wellness-bath-ritual.webp`
- `plp-private-breakfast-pool.webp`

## Remaining production checks

- Add an official phone or WhatsApp number once confirmed.
- Test booking creation and Xendit checkout end to end.
- Enable the Supabase content table if the content editor should be active.
- Later replace CSS background galleries with real responsive image markup for deeper performance work.
