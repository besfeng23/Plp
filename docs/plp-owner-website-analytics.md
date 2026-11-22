# Owner website analytics — PLP Boracay

The existing **authenticated Client Workspace** now includes Website Analytics. This is not a separate application or Doctora-specific identity yet: it uses the current shared staff access gate.

## Data source and definitions
Reports read the existing PLP Supabase `plp_analytics_events` table using the protected `/api/admin?action=owner-behavior&month=YYYY-MM` route. The source stores approved event names and public page paths only after affirmative analytics consent. Data are grouped by month and Philippine local day and include recorded page views, top pages, reservation clicks, booking starts/requests, room selections and concierge/Pearl Club/residential-interest enquiries.

This is **event counting**, not unique visitors, user journeys, sessions, bounce, retention, real reservations, approved memberships, payment or revenue. Never divide aggregate actions by page views and call that a visitor conversion rate. Non-consenting visitors are excluded. Partial reads exceeding 10,000 events do not present totals. The endpoint uses private no-store and staff authentication, and returns only aggregated anonymous data.

## Additional visitor intelligence — not connected
Unique/returning visitor counts, sources/UTMs, countries/devices, engagement duration and navigation paths need a **verified property actually associated with plp-boracay.vercel.app**. The connected PostHog default project has not been verified as PLP. Verify GA4/PostHog site ownership, consent policy, timezone, data freshness, event names and purpose first. Keep API access secrets on the server. Session replay remains disabled until separately approved after privacy review. Boracay and Changi chapter tracking must remain separate.

## QA
Run `npm test`, `npm run check:viewport`, `npm run build`. Check authenticated admin navigation, month controls, missing-source and high-volume failure states, mobile layout, consent-only counting, and permission denial.
