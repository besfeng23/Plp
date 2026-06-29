# Claude Code Project Guardrails

Use this file when working in Claude Code on Pueblo La Perla Boracay.

## Project identity

Pueblo La Perla Boracay is a private hillside luxury resort website. The public site should feel calm, editorial, credible, mobile-first, and conversion-aware. Do not turn the homepage into a dumping ground.

## Required skill

For public-site UX, content architecture, resort design, gallery, navigation, booking-page copy, or luxury hospitality decisions, use:

`world-class-luxury-resort-ui-ux`

The project skill lives at:

`.claude/skills/world-class-luxury-resort-ui-ux/SKILL.md`

## Non-negotiables

- Every page needs a clear job.
- Every section needs a reason.
- Every CTA needs correct timing.
- Every homepage item must earn its place.
- Do not add fake phone numbers, fake reviews, fake awards, fake amenities, fake maps, or fake policies.
- Do not invent property facts.
- Do not overload the homepage to solve weak information architecture.
- Do not use generic luxury filler copy.
- Do not touch payment, webhook, booking status, Supabase service-role, or Xendit verification logic unless the task explicitly requests backend payment work.

## Files to inspect before major public UX work

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

## Required validation

Run these before claiming readiness:

```bash
npm run build
npm run check:viewport
npm run check:routes
```

If `npm run check:routes` fails because the execution environment cannot reach Vercel, say that clearly and do not pretend live production was verified.

## Branching rule

Start new luxury UX work from `main`, not from stale PR branches. Existing old PRs may touch the same files and should not be used as the base unless they are intentionally revived and rebased.
