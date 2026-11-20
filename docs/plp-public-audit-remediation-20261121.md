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
| Club activity API failure is indistinguishable from no dates scheduled | Club UI distinguishes unavailable calendar service from an actual empty published schedule; concierge email/phone and activity location notes remain accessible. | Source review and build; **live API failure remains unresolved**. |
| Payment-return pages can be indexed or cached | Generated return shells have `noindex,nofollow`; `/booking/success` and `/booking/cancel` have no-store headers. | Unit tests for generated metadata; production response not yet verified. |

## Unresolved verification / owner decisions

1. **Club calendar database — production failure.** The observed public Club activity endpoint returned HTTP 503. A migration exists at `supabase/migrations/20261120174220_plp_club_boracay_members_activities.sql`, but no verified PLP production Supabase project binding was available. The listed Supabase connector projects do not unmistakably correspond to PLP. **Do not apply this migration to a guessed project**, or mask a database failure as a healthy empty schedule. Resolve the exact project and review the migration/RLS, logs, advisories, and published activity rows first.
2. **Room pricing — owner-approved tariff needed.** `lib/pricing.js` deliberately has USD 1,000/night across all three tiers for testing. No alternate commercial prices or activation date has been approved. Do not change those values based on inference. The 30% deposit derives from this file and is exposed in guest quote and provider checkout flows. Confirm the complete price matrix, taxes/fees, seasons, occupancy, deposit and payment terms before changing live prices.
3. **Payment policy and booking gate.** The site can save a booking request and immediately offer an online deposit checkout, even though availability and cancellation/changes terms require further resort review. This is a substantive commercial/service-flow decision. Obtain written owner-approved cancellation/refund terms and clarify whether a deposit may be collected before the team issues final confirmation. Require transaction-specific tests, reconciliation and provider-mode verification before changing or activating payment behavior.
4. **Membership terms and activities.** PLP Club Boracay is a proposed 60+ community; Singapore/Changi and Malaysia are proposed chapters. Membership fees, benefits, venues, event dates, accessibility arrangements, transport and local operators are not confirmed and must not be represented as active commitments. Publish real activities only after operator confirmation and database verification.
5. **Preview and production proof.** The branch must pass a real browser smoke test at a Vercel preview URL (desktop and mobile, direct-route refreshes, gallery keyboard, reduced motion, Club 503 fallback), an independent change review, and explicit deployment approval. After release, repeat direct-route HTTP/metadata and live API checks. The original intermittent blank-screen report needs monitoring across clients/cache edges; this fallback fix is mitigation, not a proven diagnosis.

## Verification commands

```bash
npm test
npm run build
npm run check:viewport
```

Do not test a real card, initiate a real deposit, or submit live guest PII in automated smoke tests. Treat published prices, membership promises, and payment/deposit policies as commercial owner-controlled claims.
