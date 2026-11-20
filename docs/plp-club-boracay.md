# PLP Club — Boracay Senior Membership Pilot

**Status:** Proposed program; implementation on an isolated feature branch. Not an approved commercial offer or a confirmed event schedule.

## Product decision

Create one PLP Club concept with chapter-level operations and separate records for each location. The initial chapter is **Boracay, Philippines**. Singapore and Malaysia are **future chapter concepts**, not claimed PLP facilities or operating locations.

The initial audience is adults **60 and above**. That threshold is a *proposed private-club rule*, not an automatic determination of eligibility for statutory Philippine senior-citizen benefits. Government discounts and IDs are separate matters requiring review.

The experience should feel like the PLP brand: editorial, unhurried, warm, and personal. A club page has one job: explain the proposal, show only confirmed scheduled activities, and make it easy to contact PLP. Do **not** clutter the resort homepage with a full activity catalog or membership details.

## Proposed member experience

1. Discover `/club` from the public navigation (separate from resort booking).
2. Read the Boracay program's purpose and *possible* activity themes.
3. View only future, staff-published activities; no fabricated sessions or dates.
4. Contact the team to express interest. This does **not** create a membership or RSVP.
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
- Staff-only PLP Club page: member intake with consent acknowledgment; PENDING → ACTIVE / DECLINED / INACTIVE decisions; draft/publish/cancel activities.
- Club actions are dispatched through the existing `/api/plp?action=club&operation=...` serverless function, with isolated implementation in `lib/club-handler.js` and `api/_clubDb.js`. This avoids a thirteenth Vercel function on the Hobby plan and does not change booking or payment clients.
- New chapter-aware tables: `plp_club_chapters`, `plp_club_members`, `plp_club_activities`.
- Row-level security enabled and API table privileges revoked from `anon` and `authenticated`.
- No new credentials, payment mandates, PayPal transactions, or modifications to reservations.

## Important limitations — *not yet built*

- Public self-service enrollment, OTP/email verification, identity checks, family/caregiver authorization, and individual member login.
- Event RSVPs, attendance tracking, guest limits, waitlists, capacity enforcement, and member communications.
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

## Required owner decisions

1. Is **60+** the correct private membership age, and is the audience Boracay locals, visiting seniors, or both?
2. Is Boracay membership **free, paid annually, monthly, or tiered**? Which concrete benefits are authorized?
3. Which 2–3 activities and dates can PLP actually organize first, and who operates them?
4. Should the club be branded **PLP Club**, **PLP Senior Club**, or another approved name?

Until approved, the public page uses cautious "proposed" language and does not accept money or create memberships automatically.
