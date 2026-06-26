# PLP production audit fixes

Implemented after live site audits and user testing feedback.

## Done

- Homepage now preloads the current sunset hero image instead of the older villa-close aerial.
- Homepage Open Graph and Twitter preview now use the real sunset hero image instead of the SVG preview.
- Homepage loads `/image-placement.css` in the document head for earlier image styling.
- Hero CSS now targets the actual React background layer and hides the old text placeholder.
- Static public pages receive a mobile action bar with Book, Rooms, and Help links.
- Static public pages receive a trust strip for location, room-and-date booking, transfer support, and concierge email.
- The booking page receives clearer assurance explaining that guests should pick room and dates first and that final confirmation follows PLP review.
- The build generates optimized WebP versions of the selected PLP images before Vite runs.
- Homepage metadata and live image placement point to production WebP filenames.
- Remaining support-image variables now also point to generated WebP filenames instead of UUID PNGs.
- Static HTML pages are prepared during build so the image stylesheet, mobile Reserve link, trust strip, mobile action bar, room-specific booking links, and booking assurance exist in the built files rather than depending only on runtime JS injection.

## Booking and navigation usability pass

Feedback from people testing the site showed that booking and navigation were still harder than they should be. The booking path was simplified:

- `/booking` now uses a clearer Book Direct flow.
- The page has a sticky shortcut bar: Choose room, Dates, Details, Send request.
- Room selection cards are larger and clearer.
- The summary updates immediately after room/date selection.
- The submit CTA is clearer: Send request.
- Date errors now jump users back to the dates section.
- Booking links can pass a room selection through the URL, such as `/booking?room=grandOceanVilla`.
- Accommodation-page CTA links are rewritten during build to preselect the correct room.

## Build-time image optimization

Because the chat GitHub connector cannot upload binary WebP files directly, the project converts the selected source PNG files during build with `scripts/optimize-plp-images.mjs`.

The build command is:

```bash
node scripts/optimize-plp-images.mjs && node scripts/prepare-plp-static-pages.mjs && vite build
```

Generated production image names:

- `plp-hero-sunset.webp`
- `plp-hero-day.webp`
- `plp-hero-evening.webp`
- `plp-grand-villa-exterior.webp`
- `plp-villa-golden-exterior.webp`
- `plp-villa-exterior-alt.webp`
- `plp-pool-ocean-view.webp`
- `plp-master-bedroom-view.webp`
- `plp-sunset-balcony.webp`
- `plp-day-balcony-sea-view.webp`
- `plp-rooftop-evening-lounge.webp`
- `plp-smart-room-twin-view.webp`
- `plp-bedroom-balcony-outlook.webp`
- `plp-bath-tub-greenery.webp`
- `plp-bathroom-vanity-shower.webp`
- `plp-poolside-experience.webp`
- `plp-wellness-bath-ritual.webp`
- `plp-private-breakfast-pool.webp`

## Static page preparation

`scripts/prepare-plp-static-pages.mjs` prepares public static HTML pages during build. It skips internal/admin/review pages and adds:

- direct `/image-placement.css` link
- top mobile Book Now link
- trust strip
- bottom mobile action bar
- booking assurance block on `booking.html`
- room-specific booking links on `accommodation.html`

## Remaining production checks

- Add an official phone or WhatsApp number once confirmed.
- Test booking creation and Xendit checkout end to end.
- Enable the Supabase content table if the content editor should be active.
- Later replace CSS background galleries with real responsive image markup for deeper performance work.
