# PLP Club — Boracay Senior Membership Pilot

**Status:** Proposed program; the Boracay website and code foundation are merged, but this is not an approved commercial offer, operational launch, or confirmed event schedule.

## Product decision

Create one PLP Club concept with chapter-level operations and separate records for each location. The initial chapter is **Boracay, Philippines**. Singapore and Malaysia are **future chapter concepts**, not claimed PLP facilities or operating locations.

The initial audience is adults **60 and above**. That threshold is a *proposed private-club rule*, not an automatic determination of eligibility for statutory Philippine senior-citizen benefits. Government discounts and IDs are separate matters requiring review.

The experience should feel like the PLP brand: editorial, unhurried, warm, and personal. A club page has one job: explain the proposal, show only confirmed scheduled activities, and make it easy to contact PLP. Do **not** clutter the resort homepage with a full activity catalog or membership details.

## Proposed member experience

1. Discover `/club` from the public navigation (separate from resort booking).
2. Read the Boracay program's purpose and *possible* activity themes.
3. View only future, staff-published activities; no fabricated sessions or dates.
4. Choose an activity interest or ask about membership. With the concierge migration installed, the form creates a staff enquiry that can be followed up in Guest Experience and PLP Club. Staff review membership separately.
5. Staff explain terms and collect express consent, then record a **PENDING** application in protected Admin → Client Workspace → PLP Club.
6. Staff review eligibility and approve or decline. Only **ACTIVE** records count as members.

Potential activity pillars (ideas only; no dates, vendors, or inclusions assumed):

| Theme | Program concepts | Operational considerations |
| --- | --- | --- |
| Connection | Coffee mornings, interest circles, social lunches | Seating, proximity, quieter spaces |
| Gentle wellbeing | Gentle stretching, low-intensity guided sessions | Qualified facilitators, suitability, optional participation |
| Culture & learning | Arts, music, heritage talks, storytelling | Space, facilitator, transport if off-site |
| Island experiences | Slow-paced walks, curated outings, photo days | Weather, mobility needs, toilets, transport, accessibility |

No activity should claim medical benefit, accessibility, transfer inclusions, or safety certification without actual verification. Obtain participant needs when planning a **specific event**, with proportional and secure data handling.

## Current engineering scope

- Public route `/club`: editorial invitation, proposed pillars, server-backed published calendar, concierge inquiry.
- Staff-only PLP Club page: member intake with consent acknowledgment; PENDING → ACTIVE / DECLINED / INACTIVE decisions; draft/publish/cancel activities. A separate attendance migration lets staff check active Boracay members into published activities after the start and correct check-ins. Concurrent check-ins share the activity capacity.
- Club actions are dispatched through the existing `/api/plp?action=club&operation=...` serverless function, with isolated implementation in `lib/club-handler.js` and `api/_clubDb.js`. This avoids a thirteenth Vercel function on the Hobby plan and does not change booking or payment clients.
- New chapter-aware tables: `plp_club_chapters`, `plp_club_members`, `plp_club_activities`.
- Row-level security enabled and API table privileges revoked from `anon` and `authenticated`.
- No new credentials, payment mandates, PayPal transactions, or modifications to reservations.

### Guest and staff release dependencies
Apply the approved migrations in order. The foundation `20261120174220` enables the Boracay calendar and private member and activity records. Migration `20261120230000` enables staff attendance. Migration `20261120231000` enables the private concierge inbox in the resort runtime schema. The last two are separate additions.

Once the inbox is available, a guest submission returns success only after it is recorded. Staff can open Guest Experience for all enquiries, or PLP Club for membership and activity enquiries. Without the inbox, the form can use a configured concierge email sender or prepare a guest email draft. Reverting the application to the prior deployment preserves recorded enquiries and attendance.

## Important limitations — *not yet built*

- Public self-service enrollment, OTP/email verification, identity checks, family/caregiver authorization, and individual member login.
- Advance event reservations, companion registration, waitlists, and automated member messages.
- Paid membership, renewal, invoicing, government discount handling, refund/cancellation policies, and tax analysis.
- Verified age and any legal benefit or ID acceptance process.
- Role-specific access: the first iteration reuses the existing PLP shared staff code and cannot enforce separate club operators per person.
- Immutable change history or staff-identity audit logs. These are required before broad operational rollout.

## Pre-launch gates

1. **Owner/program approval:** purpose, exact name, 60+ eligibility, visitors vs residents, member count, fees (if any), privileges, trial/renewal policy, accessibility/caregiver rules, and service area.
2. **Operations:** PLP staff owner, program coordinator, actual activity suppliers/facilitators, safety and emergency procedures, capacity, transport and weather contingencies.
3. **Privacy/legal:** final consent notice, retention/deletion schedule, contact preferences, official senior ID handling *only if genuinely necessary*, data protection across countries before SG/MY rollout.
4. **Database:** verify the **correct** PLP Supabase project and review the migration before applying; ensure the Data API exposes `public` to service-role server calls but not the new tables to browser roles. Confirm no unexpected schema drift.
5. **Security:** replace shared staff code with role-based identity before scaling; add per-action audit records and reviewed member communications.
6. **QA:** run tests, build, mobile layout, server-authority checks, empty-state checks, static/React navigation, preview smoke test and production route audit **after** preview.

## Next phases

**Phase 2 — Member journey:** protected verified application, status notices, member portal/card, event booking with atomic capacity allocation, RSVP confirmation, cancellations and attendance, accessible event details, caregiver/companion rules.

**Phase 3 — Commercial program:** only after price/benefit decisions, add fees/renewal/payment, operational reporting, member activity insights, consent-based reminders and partner benefits.

**Phase 4 — Regional chapters:** Singapore and Malaysia with explicit location availability, localized age/consumer/privacy review, currency/time-zone and program coordinators, chapter-scoped access policies. No replication of Boracay members across regions by default.

### Singapore venue direction — 21 November 2026

The owner has identified **Changi Beach Club**, 2 Andover Road, Singapore 509984, as the **intended venue** for the future Singapore PLP Club chapter. This is a planning decision, not evidence of a venue agreement, sponsorship, joint operation, existing PLP premises, or member access. CBC has its own independent membership program.

The public `/club` page may identify the planned venue only with the explicit qualification that **no PLP–CBC partnership, scheduled activity, or facility privilege is confirmed**. Proposed 60+ activity themes include social mornings, cultural and heritage gatherings, gentle recreation, and coastal outings; none are published events or benefits. No Changi Beach Club images or marks are licensed for PLP use by this decision.

Source checks: [CBC official site](https://changibc.org.sg/) and [facilities/contact](https://changibc.org.sg/facilities-information-booking/) (main address and independent venue), reviewed 21 November 2026. The owner's Changi Beach Club research document was the planning input, not an agreement. Confirm the authorized contracting entity, permission to use the venue and brand, event spaces, liability/accessibility, actual availability, Singapore PDPA requirements, local membership terms, fees and staff before any Singapore enrollment, payment or activity booking. The database chapter remains `PLANNED`; the Boracay calendar and staff flows must not be relabeled as Singapore functionality.

## Required owner decisions

1. Is **60+** the correct private membership age, and is the audience Boracay locals, visiting seniors, or both?
2. Is Boracay membership **free, paid annually, monthly, or tiered**? Which concrete benefits are authorized?
3. Which 2–3 activities and dates can PLP actually organize first, and who operates them?
4. Should the club be branded **PLP Club**, **PLP Senior Club**, or another approved name?

Until approved, the public page uses cautious "proposed" language and does not accept money or create memberships automatically.

## Owner-authorized Club public reopening — 22 November 2026

The owner has expressly instructed the PLP Club Boracay website and staff workflows to be reopened, reporting that Doctora has paid for the underlying PLP engagement. This is **owner-reported confirmation**, not an independently verified finance transaction or proof of any paid Club memberships. The reopening reverses the focused temporary public launch hold from PR #81 while preserving later PLP editorial branding and existing reservations/security. The Boracay Club is available as an informational and enquiry-led 60+ community pilot with staff-managed consenting membership applications and publish-only scheduled activities. It does **not** advertise a finalized membership price, guaranteed activities/venues, automatic senior-citizen statutory discounts, paid membership checkout, or operating Singapore/Malaysia chapters. Staff authentication and protected Club member records remain required. Do not create members or activities automatically.
