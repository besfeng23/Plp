# PLP public-site audit remediation — 2026-11-21

Scope: `besfeng23/Plp`, public Boracay experience, reviewed against the deployed `https://plp-boracay.vercel.app/` baseline. This record distinguishes implemented source fixes from production actions that remain gated. It is not proof of a production deployment.

## Implemented on the audit-repair branch

| Finding | Source correction | Verification |
| --- | --- | --- |
| Initial page can become blank while the app does not render | The guest-readable static shell stays visible until React itself mounts; an application error shows a concierge fallback. | Unit test and build. Root cause of intermittent production behavior has **not** been established. |
| Public club/gallery/legal/room URLs sent generic homepage social metadata | Build now emits route-specific first-response HTML, canonical, Open Graph, Twitter text, WebPage structured data, and a usable fallback. Vercel rewrites map those routes to the generated files. | Shell unit tests and built `dist` output. |
| Gallery keyboard focus escapes behind the lightbox | Dialog initially focuses close, traps forward/reverse Tab, retains arrow/Escape controls, and restores focus to the selected image tile. | Source review and build. Live keyboard smoke test still required. |
| Cinematic video ignores reduced-motion settings | Autoplay clip is withheld on reduced motion, pauses when the preference changes, and has a visible Pause/Play control for other visitors. | Source review and build. |
| Navigation elements are inaccessible as links | Main navigation, footer, and mobile sticky actions use actual anchor links with browser new-tab behavior. Mobile targets are at least 44–48 px high. | Source review and build. |
| Exclusive-offer page presents unapproved entitlement | Reframed as a proposal, with no unapproved multi-year benefit or price offered for sale. | Source review and unit-backed build. |
| Club activity API failure is indistinguishable from no dates scheduled | Club UI distinguishes unavailable calendar service from an actual empty published schedule; concierge email/phone and activity location notes remain accessible. | Source review, build and hosted outage simulation. The production calendar recovered after the foundation migration documented below. |
| Payment-return pages can be indexed or cached | Generated return shells have `noindex,nofollow`; `/booking/success` and `/booking/cancel` have no-store headers. | Unit tests for generated metadata; production response not yet verified. |

## Production verification and owner decisions

1. **Club calendar restored in production on 21 November 2026 (Manila).** The original audit traced HTTP 503 to three missing tables in the database bound to the live website. With owner approval, the repository migration `20261120174220_plp_club_boracay_members_activities.sql` was applied. The migration ledger now records version `20261120174220` and its stored SQL matches the Git source. All three tables have row-level security and deny direct reads to browser roles. The live activities endpoint returned HTTP 200 with zero upcoming activities. The private members endpoint returned HTTP 403 without staff credentials. Boracay is the pilot for the 60+ club and Singapore and Malaysia are planned. The private concierge inbox and attendance register use separate migrations in PR #75.
2. **Room pricing — owner-approved tariff needed.** `lib/pricing.js` deliberately has USD 1,000/night across all three tiers for testing. No alternate commercial prices or activation date has been approved. Do not change those values based on inference. The 30% deposit derives from this file and is exposed in guest quote and provider checkout flows. Confirm the complete price matrix, taxes/fees, seasons, occupancy, deposit and payment terms before changing live prices.
3. **Payment policy and booking gate.** The site can save a booking request and immediately offer an online deposit checkout, even though availability and cancellation/changes terms require further resort review. This is a substantive commercial/service-flow decision. Obtain written owner-approved cancellation/refund terms and clarify whether a deposit may be collected before the team issues final confirmation. Require transaction-specific tests, reconciliation and provider-mode verification before changing or activating payment behavior.
4. **Membership terms and activities.** PLP Club Boracay is a proposed 60+ community; Singapore/Changi and Malaysia are proposed chapters. Membership fees, benefits, venues, event dates, accessibility arrangements, transport and local operators are not confirmed and must not be represented as active commitments. Publish real activities only after operator confirmation and database verification.
5. **Preview and production proof.** The combined release in PR #75 passed real mobile and desktop Chromium checks against the protected Vercel preview, including the room and party-size handoff, Club activity interests, the gallery keyboard controls, reduced-motion preferences and a simulated calendar outage. All 26 audited routes and the 12 generated first-response metadata sets passed on the preview. The PR records the deployment identity and release state. After production release, repeat direct-route, metadata and live API checks. The original intermittent blank-screen report needs monitoring across clients/cache edges; this fallback fix is mitigation, not a proven diagnosis.

## Verification commands

```bash
npm test
npm run build
npm run check:viewport
```

Do not test a real card, initiate a real deposit, or submit live guest PII in automated smoke tests. Treat published prices, membership promises, and payment/deposit policies as commercial owner-controlled claims.
