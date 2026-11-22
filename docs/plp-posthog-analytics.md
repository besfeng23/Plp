# PLP Boracay PostHog analytics

## Browser capture
- The existing optional analytics consent gate is retained and versioned to v2 so previous consent is not silently expanded.
- PostHog is initialized only after affirmative consent on allowlisted public pages. `/admin`, `/owner`, payment-return paths, and non-public routes are excluded both at the public tracker and SDK event-filter layers.
- Pageviews are sent manually for SPA navigation. Autocapture is limited to public anchor/button clicks; form elements, inputs and text values are excluded. Web vitals are captured via `capture_performance`.
- Session replay is disabled. `maskAllInputs` remains true as defense in depth.
- The project token is a public ingestion token delivered by the consent-gated analytics-config endpoint. The PostHog personal API key is server-only.
- A same-origin `/ingest` proxy routes to the PostHog US ingestion and static-asset hosts.
- GA4 remains off unless `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured. No GA4 property or measurement ID is assumed.

## Owner reports
The private owner endpoint queries PostHog project 526760 for the selected Boracay-local month and returns only aggregate pageviews, pseudonymous unique visitors, sessions, top pages, referrers, country/device breakdowns, and the ordered booking-interest funnel. It excludes `/admin` and `/owner` paths. The API reads `POSTHOG_PERSONAL_API_KEY` only from the Vercel server environment; it is never sent to the browser, included in logs, or returned in an error. Until that key exists with query permission, the UI displays **Not connected**.

## External project-setting prerequisite
At implementation time, PostHog project 526760 listed three other app URLs and did not include `https://plp-boracay.vercel.app`. The connected PostHog integration does not currently expose the `project:write` scope needed to update authorized URLs. No claim is made that the domain was added. Reconnect PostHog with project-settings write permission and add the PLP production URL before treating domain authorization as verified.

## Privacy notes
- PostHog browser capture remains consent gated.
- Session recording is disabled.
- Form values, names, emails, booking references and health details are not sent by this implementation.
- The existing SDK config suppresses direct IP capture; if country enrichment is absent, the owner UI shows that the data is unavailable rather than inferring a country.
- GA4 is optional and remains unconfigured.
