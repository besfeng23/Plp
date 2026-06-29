# Claude Code Luxury UX Readiness Handoff

This repo is being prepared for a controlled luxury resort UX test using the project skill:

`.claude/skills/world-class-luxury-resort-ui-ux/SKILL.md`

## Current readiness verdict

Ready to test from a clean branch based on `main`, with two cautions:

1. There are old open PRs that touch overlapping public-site/mobile files. Do not base new work on them unless they are intentionally revived and rebased.
2. Live production route checks may fail from restricted execution environments. If that happens, report the limitation clearly.

## Known open PR caution

As of this handoff, these older PRs are still open and not mergeable:

- PR #6: `PLP production readiness and route audit pass`
- PR #8: `Fix mobile public-site polish and skip-link artifact`

New luxury UX work should start from `main` unless the operator explicitly says to use another branch.

## Target task for the skill test

The next Claude Code run should not simply make the site prettier. It must test whether the skill can enforce page ownership, restrained homepage architecture, mobile-first conversion, and luxury proof placement.

Recommended Phase 1 scope:

1. Produce `docs/luxury-resort-ux-audit.md`.
2. Add a proper `/gallery` page.
3. Add Gallery to public navigation and footer exploration.
4. Remove `Exclusive Offer` from primary navigation while keeping the route available.
5. Improve Contact into a stronger Concierge page without inventing facts.
6. Fix sitemap canonical hygiene.
7. Replace brittle image selectors with semantic selectors where safe.
8. Do not touch payment, webhook, booking status, Supabase service-role, or Xendit verification logic.

## Files to inspect first

- `src/App.jsx`
- `src/VideoSection.jsx`
- `src/index.css`
- `public/booking.html`
- `public/accommodation.html`
- `public/experiences.html`
- `public/image-placement.css`
- `public/sitemap.xml`
- `vercel.json`
- `scripts/prepare-plp-static-pages.mjs`
- `README.md`

## Required audit document sections

`docs/luxury-resort-ux-audit.md` must include:

1. Executive verdict
2. Guest journey diagnosis
3. Page ownership map
4. Homepage keep/move/remove decisions
5. Missing pages
6. Navigation diagnosis
7. Booking flow diagnosis
8. Image placement diagnosis
9. Mobile UX diagnosis
10. Priority implementation plan

## Acceptance criteria

- `npm run build` passes.
- `npm run check:viewport` passes.
- `npm run check:routes` passes or clearly reports a network limitation.
- `/gallery` is reachable if implemented.
- Homepage does not become a content dump.
- `Exclusive Offer` is not in primary nav.
- Contact/Concierge page has stronger trust and clearer inquiry routing.
- No fake claims, phone numbers, awards, reviews, amenities, addresses, policies, or location details are introduced.
- Existing booking/payment logic is preserved.

## Operator prompt

Use this in Claude Code after this readiness branch is merged or after applying the files locally:

```text
Use the world-class-luxury-resort-ui-ux skill.

Carefully audit and improve the PLP luxury resort website information architecture. Do not make the homepage longer just to show everything. Every page needs a job, every section needs a reason, and every CTA needs timing.

Start by reading CLAUDE.md and docs/claude-code-luxury-ux-readiness.md. Then inspect the files listed there.

First produce docs/luxury-resort-ux-audit.md with the required sections. Then implement Phase 1 only:
- /gallery page
- Gallery navigation/footer links
- demote Exclusive Offer from primary nav
- stronger Contact/Concierge page
- sitemap canonical cleanup
- safer semantic image selectors where needed

Do not touch payment/webhook/Supabase/Xendit verification logic.

Run npm run build, npm run check:viewport, and npm run check:routes. Report failures honestly.
```
