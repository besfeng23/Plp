# PLP Boracay — Doctora's operational owner office

The same existing **besfeng23/Plp** production app serves the `/owner` no-passcode public shell. Public navigation offers working Boracay booking/club pages and published Club activities; the preview never requests or exposes private owner analytics, member details, customer records or financial statements.

**Authenticated office:** Doctora's confirmed Supabase Auth email can receive a passwordless magic link, establish a signed 6-hour HttpOnly, Secure, SameSite=Strict owner cookie, and automatically reopen the private dashboard during that verified session. Her identity is reverified server-side; the shared staff code never grants owner access.

**Verified read sources:** actual site-sourced bookings (website requests, confirmed statuses), arrivals/departures, anonymous consented website page/action events, PLP Boracay Club members and published activities, staff tasks, and concierge enquiry counts. Unavailable reports never show estimated zeros. Changi and Malaysia remain proposed; no unapproved membership, residential, medical or pricing claims.

**Private owner workflow:** Add/update/search/filter owner decisions, notes, partner follow-ups, milestones and external document references per chapter. A guarded backend requires verified owner login and matching request origin for mutations. Supabase migration `20261122004907_plp_owner_private_work_items_v1` is applied. Both tables use RLS and service-role-only access; triggers record change history. Status `reviewed` is an internal planning decision and never publishes offers, activates memberships, books guests, or charges clients.

**Reports:** Local CSV exports for real booking counts, consented website behavior and owner register. CSV formula injection is escaped. External documents are only links, not stored file uploads.

**External prerequisites:** The owner's email Auth account did not exist when inspected. The first email magic-link login requires her participation and verified Supabase allowed redirect URL. Independent GA4/PostHog site-specific unique visitors, traffic sources, devices, heatmaps/session replay, verified accounting/bank settlements, AI assistant, property cameras, private uploaded document vault and fine-grained staff RBAC remain unconnected and must not be represented as operational.

**Engineering constraints and lessons:** Vercel Hobby caps serverless functions at 12, so the owner route is dispatched via existing `api/plp.js`; do not reintroduce `api/owner.js` without upgrading/optimizing. Owner work-item tools must remain accessible even when optional monthly business data sources fail. Never loosen the owner report boundary to make the entire privately owned business view public.

**Verification:** CI tests, viewport fit and Vite build. After merge verify exact production SHA READY and unauthenticated owner reports return 401. A verified owner email-login walkthrough is still needed for complete end-to-end acceptance.
