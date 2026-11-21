# PLP editorial brand system — master and chapters

Owner-provided PLP_Editorial_Brand_Pack.zip, 21 November 2026.

The original vector files in public/brand are byte-for-byte identical to those supplied in the brand pack, with Git blob SHA-1 verification. Brand colors: deep brown #421909; warm ivory #FAF1E0.

- public/brand/PLP_Editorial_Vector_Logo.svg — preferred normal crest for ivory/light backgrounds
- public/brand/PLP_Editorial_Reversed_Ivory.svg — ivory-only crest for dark backgrounds
- public/brand/PLP_Editorial_Web_1024.webp and .png — web fallbacks and previews
- public/brand/PLP_Editorial_App_512.png — app icon
- public/favicon-32.png, public/favicon-64.png, public/apple-touch-icon.png — browser/PWA icons
- public/favicon.svg — same source as the normal master vector
- public/brand/USAGE.txt — supplied usage instructions

The public header changes between master and reversed crest when its background changes; admin login uses master, admin sidebar/footer use reversed crest. Location labels stay as HTML text, never stamped into the shared master. The existing Boracay pages, PLP Club pause, bookings, APIs, Supabase schema and runtime settings are unaffected by these asset-only and presentation updates.

## Oval-only browser, Android and Apple icons — 2026-11-21

At the owner's request, browser / bookmark / mobile icons must display the **oval only**, not the original opaque ivory square. The originally supplied `favicon-32.png`, `favicon-64.png` and `apple-touch-icon-180.png` had alpha=255 at all corners, creating a cream square in Android Chrome's address suggestions. The 512px app master already had a transparent image, but its source dimensions were not square.

Derived replacements from the **owner-supplied 4K transparent PLP master** by cropping to the alpha bounds, preserving the oval and its interior ivory details, centering it with proportional padding on square fully transparent RGBA canvases. Exact source artwork is not redesigned. Rebuilt transparent PNGs at 16/32/64/180/192/512px plus a transparent legacy `favicon.ico`. The 512px asset is now a genuinely square transparent app icon; the transparent PNGs' corners have RGBA=(0,0,0,0) and alpha ranges 0–255.

Root `index.html`, `admin.html`, and `booking.html` refer to versioned favicon URLs to help bust mobile browser caches. `public/site.webmanifest` uses the same versioned assets for Chrome/PWA. The existing `public/favicon.svg` remains the exact master SVG and has no square background. The icons set `purpose: any`; do not claim maskable status because native device launchers may impose their own surrounding tile. Browser icon caches and suggestions may take additional time to refresh.

No Club launch switch, member records, service-role secrets, payment code, or tenant settings were touched by this visual-only change.
