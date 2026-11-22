# PLP Boracay PostHog analytics

## Browser capture
- The existing optional analytics consent gate is retained and versioned to v2 so previous consent is not silently expanded.
- PostHog is initialized only after affirmative consent on allowlisted public pages. `/admin`, `/owner`, payment-return paths, and non-public routes are excluded both at the public tracker and SDK event-filter layers.
- Pageviews are sent manually for SPA navigation. Autocapture is limited to public anchor/button clicks; form elements, inputs and text values are excluded. Web vitals are captured via `capture_performance`.
- Session replay is disabled. `maskAllInputs` remains true as defense in depth.
- The project token is a public ingestion token delivered by the consent-gated analytics-config endpoint. The PostHog personal API key is server-only.
- A same-origin `/ingest` proxy routes to the PostHog US ingestion and static-asset hosts.
- GA4 remains off unless `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured. No GA4 property or measurement ID is assumed.

## Visitor recognition and owner reports (2026-11-23)
- Consent-gated PostHog already retains a pseudonymous browser `distinct_id` in localStorage/cookie when storage is available and consent remains allowed. This supports same-browser returning-visitor analysis, **not** the person's legal name, validated account, or cross-device identity.
- The owner and existing staff-admin analytics now request aggregate **first observed this month** and **seen before this month** visitor cohorts. A returning visitor must have a prior consented PLP public pageview in PostHog; someone who browsed before analytics installation or from another device may appear as new.
- The server query now requires `PLP_POSTHOG_PROJECT_ID` (numeric project ID), `PLP_POSTHOG_HOST` (approved US/EU PostHog ingestion host), and `POSTHOG_PERSONAL_API_KEY` with query access. The browser separately requires `PLP_POSTHOG_PROJECT_TOKEN` bound to the **same verified project** and `PLP_POSTHOG_HOST`. No secrets are shipped to browsers.
- Every visitor query is scoped to the canonical URL prefix `https://plp-boracay.vercel.app/`, excluding `/admin` and `/owner`. A PostHog project used by other websites must never produce cross-brand totals.
- The owner view is protected by the individual verified Doctora owner account; staff website analytics are protected by existing staff-code access and show only aggregate results. The shared staff code does not identify an individual employee.
- When no verified project binding or query key exists, analytics shows **Not connected**, not invented zeros.

## External PostHog project prerequisite
The connected PostHog account's project 526760 ("Default project") currently lists `battletested.vercel.app`, `eden-eco.vercel.app`, and `banatao-systems.vercel.app`, not PLP. Its project does not establish a verified PLP analytics property. Prefer a dedicated `PLP Boracay` PostHog project. The connected PostHog app lacks the `project:write` scope needed to create a project or update authorized app URLs here. Bind the actual project ID, host and project token together before interpreting results; verify ingestion with an opt-in real browser and confirm the counts in the private report. The historical user-confirmed screenshot is **not** retroactively linked to a PostHog identity.

## Future named guest identification
PostHog cannot independently discover who an anonymous visitor is. Introduce verified guest/member authentication or a secure, verified booking-to-guest identity process, then call `posthog.identify('guest:' + stable_database_guest_uuid)` **after** successful verification and optional analytics consent; call `reset()` on logout or shared-device account switch. Do not identify from a name/email merely typed into an open form, and do not send raw names, emails, phone numbers, bookings, medical information, or staff codes as PostHog person properties. Only introduce person profiles after the security/privacy review and verified guest flows. Operational guest booking records remain private in Supabase.

## Privacy notes
- PostHog browser capture remains consent gated.
- Session recording is disabled.
- Form values, names, emails, booking references and health details are not sent by this implementation.
- The existing SDK config suppresses direct IP capture; if country enrichment is absent, the owner UI shows that the data is unavailable rather than inferring a country.
- GA4 is optional and remains unconfigured.
