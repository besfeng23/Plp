# Pueblo La Perla Boracay — Luxury Resort UX Audit

_Audited with the `world-class-luxury-resort-ui-ux` skill. Scope: public marketing site (`src/App.jsx`, static `public/*.html` pages, sitemap, image placement). Booking, payment, webhook, Supabase, and Xendit verification logic were treated as out of scope and were not touched._

---

## 1. Executive verdict

The site is already calm, editorial, and restrained — it is **not** a content dump, and that is its biggest strength. Positioning ("a private hillside retreat above Boracay's white sands") is consistent and concrete. The information architecture is mostly sound: rooms, experiences, getting here, and booking each have a home.

However, three things hold it back from feeling fully world-class:

1. **A real, visible bug**: the homepage hero image was wired to a brittle CSS selector (`section.h-screen.bg-stone-900`) that no longer matches the markup (the hero now uses `min-h-[100svh]`). The hero rendered as a black block with a placeholder caption instead of the cinematic aerial. This is the single most damaging issue because it is the first screen.
2. **No gallery**. A luxury resort lives on visual proof. The property has a strong set of real photographs (villas, pool, bedrooms, baths, dining, evening ambience) that are optimised at build time but never surfaced in a browsable, grouped page.
3. **Navigation priority is slightly off.** `Exclusive Offer` — a niche 5-year loyalty product — sat in the primary navigation alongside core decision pages, competing with Accommodation and Experiences for attention. It is a conversion path for a tiny segment, not a top-level wayfinding item.

None of these require a redesign. Phase 1 fixes all three without making the homepage longer.

**Verdict: structurally healthy, let down by one broken hero, one missing page, and one mis-prioritised nav item.**

---

## 2. Guest journey diagnosis

Mapped against Dream → Orient → Compare → Trust → Commit:

| Stage | Currently served by | Health | Notes |
|---|---|---|---|
| **Dream** | Hero, property promise, video section | ⚠️ Broken | Hero image was not rendering; the dream stage opened on black. |
| **Orient** | Hero kicker ("Boracay, Philippines"), Getting Here teaser | ✅ Good | Location is stated early and repeated. |
| **Compare** | Accommodation page, Signature Stay block, Experiences | ⚠️ Partial | Rooms are clear, but there was no gallery to compare the *feel* of spaces visually. |
| **Trust** | Trust-proof section, booking policy block, FAQ, footer email | ✅ Good | Honest, non-fabricated, calmly worded. |
| **Commit** | Booking redirect, mobile action bar, contact | ⚠️ Thin | Contact was a single email line — weak for high-intent or high-value inquiries. |

The journey breaks earliest at **Dream** (hero) and is weakest at the **Compare → Commit** seam (no gallery, thin concierge).

---

## 3. Page ownership map

| Content | Primary owner | Status |
|---|---|---|
| Positioning, invitation | Home | ✅ |
| Room categories, rates, occupancy | Accommodation | ✅ |
| Curated activities (water, wellness, dining) | Experiences | ✅ |
| Arrival, ports, transfers | Getting Here | ✅ |
| Long-stay loyalty product | Exclusive Offer (`/exclusive-offer`) | ✅ route kept, demoted from nav |
| Reservation request | Booking (`/booking.html`) | ✅ untouched |
| Visual proof, grouped photography | **Gallery** | ❌ → ✅ added in Phase 1 |
| Direct inquiry, concierge routing | Contact / Concierge | ⚠️ → strengthened in Phase 1 |
| Legal | Privacy / Terms | ✅ |

Every content item now has exactly one home. Gallery was the missing owner of "visual proof."

---

## 4. Homepage keep / move / remove decisions

The homepage is well-disciplined. Recommendation is **keep almost everything as a teaser** and resist additions.

| Section | Role | Decision |
|---|---|---|
| Hero | Hero | **Keep** — but fix the broken image binding. |
| Property promise line | Emotional anchor | Keep. |
| Video section | Proof | Keep. |
| 4-point value strip | Proof | Keep. |
| Signature Stay (Grand Ocean Villa) | Teaser → Accommodation | Keep as teaser. |
| Experiences 3-up | Teaser → Experiences | Keep as teaser. |
| Getting Here strip | Navigation gateway | Keep as teaser. |
| Resort atmosphere editorial | Emotional anchor | Keep. |
| Trust-proof section | Proof | Keep. |
| Booking policy block | Proof | Keep. |
| FAQ | Proof | Keep — borderline long, but honest and useful. |
| Final reservation CTA | Conversion CTA | Keep. |

**Do not add** a full gallery, full amenity list, or testimonials block to the homepage. The gallery belongs on its own page and is reachable via nav. Homepage length is unchanged by Phase 1.

---

## 5. Missing pages

- **Gallery** (added). Owns grouped visual proof: villas/exterior, pool & deck, interiors, baths & wellness, dining, evening ambience. Built only from real, build-optimised property photography — no stock, no filler.
- **Location / map** — _not added_. The property facts needed for a credible map/neighbourhood page (exact address, verified distances) are not available, and inventing them would violate the no-fake-facts rule. Getting Here already carries the honest version. Flag for a future phase only if real data is provided.
- **Dining / Wellness as standalone pages** — _not warranted yet_. The offer is real but currently best expressed as Experiences sub-groups. Promote later only if the offer deepens.

---

## 6. Navigation diagnosis

**Before:** Overview · Accommodation · Experiences · Exclusive Offer · Getting Here · Reserve.

Problems:
- `Exclusive Offer` (a 5-year loyalty product for returning guests) occupied a primary slot, competing with core compare-stage pages. It is a narrow-segment conversion path, not wayfinding.
- No entry point to visual proof.

**After:** Overview · Accommodation · Experiences · **Gallery** · Getting Here · Reserve.

- `Exclusive Offer` route (`/exclusive-offer`) is **preserved** and still reachable from the footer and from internal links — only demoted from the primary bar.
- `Gallery` added to primary nav, mobile menu, and the footer "Explore" column.
- Footer retains Exclusive Offer so the loyalty audience can still find it.

---

## 7. Booking flow diagnosis

**Out of scope by guardrail** — no booking/payment/Supabase/Xendit logic was changed. Observations only:

- Booking is a server-rendered static page (`/booking.html`) reached via a hard redirect; room-specific deep links (`?room=…`) are injected at build time. This is sound.
- The mobile action bar keeps Reserve persistently thumb-reachable. Good conversion hygiene.
- The post-booking verification/cancel copy is honest about confirmation following provider verification. No false "confirmed" states. Leave as-is.

No changes made here.

---

## 8. Image placement diagnosis

The image system is ambitious — real photos are classified by *content* (not filename) and mapped via `public/image-placement.css`. But it leaned on **brittle, markup-coupled selectors**:

- `section.h-screen.bg-stone-900::before` and its child selectors **no longer matched** the hero (markup changed to `min-h-[100svh]`), so the hero image silently disappeared. Highest-impact fix.
- `.bg-stone-200` was used as a global hook to paint a fallback villa image behind every image placeholder — a Tailwind utility class is an unsafe contract; any future use of that utility would inherit a background image.

**Fix applied (safe subset):** introduced explicit, semantic hooks in the JSX and retargeted the CSS to them:
- `[data-plp-hero]` / `[data-plp-hero-bg]` / `[data-plp-hero-placeholder]` for the homepage hero.
- `[data-plp-image-fallback]` for the shared `ImageBlock` placeholder.

The static-page selectors that are genuinely semantic (`#grand-ocean-villa .visual.main`, `.rooms .room .room-visual`, `.visual[aria-label*='…']`) were **left untouched** — they are id/aria based and stable. Only the brittle utility-class couplings were replaced.

---

## 9. Mobile UX diagnosis

Mobile is a clear strength:
- Sticky bottom action bar (Reserve · Email · Concierge) with safe-area padding.
- `viewport-fit=cover` enforced across all route HTML by a build check.
- Thumb-sized tap targets (`min-h-11`), full-screen mobile menu, no horizontal overflow.

Improvements in Phase 1:
- Gallery is built mobile-first: a single responsive grid with `loading="lazy"` images, grouped by category so the user is never trapped in an endless scroll.
- Concierge page now routes intent on mobile (reserve vs. general inquiry) instead of offering a bare email line.

No regressions to the mobile action bar.

---

## 10. Priority implementation plan

**Phase 1 (this change):**
1. Add `/gallery` — grouped, real-photo visual proof page. ✅
2. Add Gallery to primary nav, mobile menu, and footer. ✅
3. Demote `Exclusive Offer` from primary nav; keep route + footer link. ✅
4. Strengthen Contact into a Concierge page with clearer inquiry routing and honest expectations. ✅
5. Sitemap canonical hygiene — point to canonical `/privacy-policy` and `/terms-of-service` (not the 301 sources), add `/gallery`. ✅
6. Replace brittle image selectors (hero + ImageBlock) with semantic data-attribute selectors. ✅

**Phase 2 (future, not in scope):**
- Per-room detail pages with their own galleries.
- A real Location page _only_ if verified address/distance/map data is provided.
- Lightbox/zoom interaction for the gallery if engagement warrants it.
- Testimonials/reviews block _only_ when real, attributable reviews exist.

**Guardrails honoured:** no fake phone numbers, reviews, awards, amenities, addresses, or policies introduced; homepage length unchanged; payment/booking logic untouched.
