# Investor presentation readiness — 17 November 2026

## Verified release record (current as of 17 November, Asia/Manila)

- **Canonical site source:** `besfeng23/Plp`, branch `main`, commit `8b9489ddf4da2daa36638c6dc1b1befaf62f40b2` after PRs #66–#70.
- **Production:** `dpl_3RdSjmrcrTcZAJ4Ke96HyMq4hn6g` at `https://plp-boracay.vercel.app`, reported `READY` by Vercel and bound to that commit.
- **Previous ready deployment for recovery:** `dpl_BAhVidnAuxYS46YiqXgVELkBroqD` at commit `63c9c8a1de9e230af64f302c0d66963f09cf6d50`. A recoverable deployment is not proof that rollback has been exercised.
- **Public routes:** all routes in `npm run check:routes` passed against production, including intentional `/privacy` and `/terms` redirects.
- **Local checks on equivalent source:** `npm test` 124 passed; `npm run build` passed; `npm run check:viewport` passed for 16 public HTML sources. PR #70 CI completed successfully; preview was `READY` behind Vercel Authentication.
- **Public browser:** premium homepage, Accommodation and Experiences visuals inspected; no broken images or horizontal overflow observed on desktop; one skip link on the homepage. Exact physical-device mobile acceptance is not proven.
- **Booking browser:** Grand Ocean Villa, 18–19 November 2026, one night: USD 1,000 estimated stay, USD 300 expected deposit, USD 700 balance; availability returned open for request, and the guest contact form opened. **No request or payment was submitted.** The booking walkthrough was performed before PR #70, which changed only Telegram content and its test.
- **Admin:** staff-code gate present; previous authorized inspection at commit `63c9c8a` showed Manage Client and ten Resort Command status modules loaded, with three clearly marked QA reservations excluded from default business totals. Staff authentication is tab-scoped and a reload requires re-entry. No guest or financial state was changed. Admin was not re-authenticated on the latest documentation-only audit.
- **Approved concierge contact:** `mfr@e-mango.com`, `+63 917 887 2980` on the public website and, after PR #70, the Telegram mini-app Directions screen. Its map is labelled as a Boracay overview, not an exact property pin.

### Demonstration boundary

Show the resort homepage, accommodation, Experiences, room comparison, booking date/estimate steps, and the authenticated administration workspace. The public guest flow is a **reservation request**; the displayed quote and open-for-request dates do not confirm a booking. Avoid live submissions or payment demonstrations without a separate, exact authorization and reconciliation plan.

Do **not** present these as operationally verified: Vision camera feed, live OTA syncing, individual staff accounts/RBAC for ten employees, production PayPal capture, email notifications, or GA4/PostHog reporting. Production analytics keys were absent in the Vercel environment metadata. The connected PostHog account exposed the unrelated `Battle` organization only, so no PLP analytics destination was created or attached. Payment environment variable names are present, but that does not prove mode, credentials, capture, or settlement. Keep real guest data and synthetic QA reservations clearly distinct.

### Evidence scope and next gates

Public route, build, static and browser evidence supports a **controlled presentation**, not unrestricted commercial or integration go-live. Before asserting full operational readiness, validate physical-phone layouts, authorized booking/payment sandbox-to-production transitions, provider notifications, staff identity/role enforcement, real OTA credentials and reconciliation, Vision access, consent-respecting analytics destinations, and rollback rehearsal. All such exercises require separate environment and side-effect authorization. No integration, secrets, environment variables, or database records were changed in the presentation-polish PRs.

## Historical preparation baseline (superseded where noted above)

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
