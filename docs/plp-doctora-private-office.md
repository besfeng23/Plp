# Dr. Marichi Fong Ramos — PLP Digital Private Office

## Actual delivery
A new first-party `/owner` page within the existing **besfeng23/Plp** Vite + Vercel project. This is a *dedicated authenticated owner surface*, not another app or rebranded staff admin. Theme: warm ivory, black owner-side navigation and official PLP oval crest.

Sections: Executive Overview, Website Analytics, Resort Performance, Pearl Club, My Decisions, Expansion, Reports & Documents, Private Office Settings. Decisions/expansion are carefully labeled planning items, not active approval workflows; Changi/Malaysia are proposals. No fake banking, payment, medical or residential offers.

## Identity and security contract
- Credentials are **never committed**. Vercel Production requires encrypted `PLP_OWNER_EMAIL` (approved owner's verified email), `PLP_OWNER_SESSION_SECRET` (cryptographically random >=48 chars), and pre-existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- The **only** permitted owner identity is an actual Supabase Auth user with confirmed email exactly matching `PLP_OWNER_EMAIL`. Do not use `user_metadata`, staff code, caller-supplied email, or an unsecured front-end role.
- Owner clicks Send private sign-in link; `POST /api/plp?action=owner&operation=login` requests a Supabase Auth email OTP/magic link for the single configured email. User can follow an implicit-flow magic link to `https://plp-boracay.vercel.app/owner` (token fragment exchanged via same-origin POST and immediately cleared from URL), or enter a code if the Supabase email template sends one.
- **Supabase Auth URL Configuration must allow** `https://plp-boracay.vercel.app/owner` as a redirect. Verify externally before saying owner login is working. The current email template/magic-link redirect allowlist was not inspected or changed. Do not claim the owner has already signed in.
- Server verifies the bearer token via `auth/v1/user` and owner email verification; issues a short (6h) signed `__Host-plp_owner` cookie with HttpOnly, Secure, SameSite Strict. Each protected read calls Supabase Auth Admin `get user` with a server-only key to confirm the identity remains permitted.
- All owner reports are aggregated server-side with no guest names/emails/phones, staff code, bearer credentials, direct finance receipts or payment mutations. The public view and shared staff-code admin do not grant private-office access.
- Owner POSTs require canonical origin. Login emails obey Supabase Auth's native rate limits, but distributed abuse throttling/WAF should be reviewed before broad public promotion; do not assume this is a fully hardened invitation system.
- No POST business mutations or owner financial transfers are implemented. App-level per-staff RBAC and formal approval audit trails remain separate work.

## Real data boundaries
- `GET /api/plp?action=owner&operation=summary&month=YYYY-MM`: monthly **website-sourced** booking request counts (not revenue), live Boracay Pearl Club member/activity status aggregates, open task count where available.
- `GET /api/plp?action=owner&operation=behavior&month=YYYY-MM`: consented, anonymous first-party site event trends, page interest and booking/enquiry events. These are **not unique visitors**; external GA4/PostHog property must be verified before acquisition/channel/device/replay features. No person/contact data or new tracking.
- Reports fail closed and show unavailable as a dash, not fabricated zero; monthly analytics refuses partial totals beyond safe pagination.
- Changi and Malaysia remain planning-only. No assumption of shared Supabase tenants or actual overseas revenue.

## Release and verification
Run `npm test`, `npm run check:viewport`, `npm run build` in PR CI. After merge verify Vercel production READY and `/owner` noindex response. Check `GET /api/plp?action=owner&operation=summary` unauthenticated returns 401. End-to-end owner login requires confirmed Supabase Auth redirect allowlist and owner receiving the actual email; never simulate or claim this human acceptance.

## Outstanding
A confirmed individual owner-login test; verified Supabase Auth redirect configuration; operational GA4/PostHog linkage; permissioned executive approval and document workflows; accounting-grade finance; identity-based staff roles.
