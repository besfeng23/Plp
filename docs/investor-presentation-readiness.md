# Investor presentation preparation — 17 November 2026

## Delivery scope

Prepare the public resort website and authenticated administration for an investor walkthrough. Base: `b28048932503a0250a0167efbda7b6e6969a36ff` in `besfeng23/Plp`. Baseline production: `dpl_GNxY6eecehHbqxvz5mk4cVzdpyD6` on the BarangayOS Vercel team.

Acceptance: remove visible placeholder content, preserve approved photography and USD 1,000 nightly rates, keep booking/date selection functional, provide focused operational navigation, separate explicitly marked test reservations from business metrics, preserve staff authorization, verify responsive layout and critical public routes.

Out of scope: booking/payment state changes, database mutations, new property claims, camera/OTA activation, sending messages, or creating live reservations. Existing test records remain recoverable and visible through an explicit display filter. No financial or guest activity may be invented for the presentation.

Validation: repository tests, build, viewport contract, route audit against its named target, public browser walkthrough and authenticated admin walkthrough. Preserve unavailable integration labels and original record inspection.

Rollback: revert the presentation commit or restore the baseline production deployment above. No migration or environment change is required.

## Baseline observations

- Public hero, accommodation, gallery and booking entry render; date selection produces a USD 1,000 one-night quote with a USD 300 deposit and USD 700 balance.
- Homepage repeats its atmosphere section and renders a bracketed placeholder label.
- Staff authentication succeeds and both administrative modes load.
- Resort Command exposes all operational, channel-planning and developer sections in one long page; wide injected tables create page-level horizontal overflow.
- Three existing reservations are explicitly prefixed `MOCK-PLP-`; these must not be presented as real guest or revenue activity.
- Camera and live OTA connections are not enabled.
- The existing route audit reports intended privacy/terms redirects as failures; derive expected redirects from the current deployment configuration.
- Pandora retrieval failed with internal errors; the exposed ProjectOS aliases report retirement. Live provider/source evidence takes precedence for this task.
