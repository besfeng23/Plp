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
