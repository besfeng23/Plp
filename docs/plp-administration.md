# PLP Enterprise Administration — Resort Command integration

## Entry point and scope

`/admin` serves `admin.html`, a React administration shell with two explicit modes:

1. **Manage Client** — the existing `/admin-ops.html` Resort Command, preserving Reservation 360, confirmation review, guest profiles, concierge and housekeeping actions, availability, OTA preparation, and payment exceptions. The previously injected admin scripts now load in order within the original page so the portal works both framed and directly.
2. **Enter Client Workspace** — an editorial PLP Enterprise view for Home, Overview, Operations, Vision, Guest Experience, Team & Access, Revenue, Needs You, Activity, and Settings. This is a React adaptation of the Pandora PLP Enterprise product direction, not a copy of the separate Flutter application/runtime.

No guest-facing route or booking/payment/Webhook logic is modified by this change.

## Source of data

The workspace loads only existing staff-authorized API actions from `/api/admin`:

| API action | Workspace uses |
| --- | --- |
| `operations` | Login authorization, reservation roster, arrivals/in-house/departures, booking review, payment exceptions, revenue signals |
| `notifications` | Saved notification activity |
| `staff-tasks` | Existing persisted tasks, and task creation for a selected loaded booking |
| `date-blocks` | Recorded date blocks for attention counts |

Secondary reads are optional and reported as unavailable when they fail. No synthetic guest names, bookings, camera feeds, or revenue figures are introduced. Verified deposits remain distinct from confirmed stays. The Revenue page is **not** an accounting or settlement ledger.

## Authorization and privacy

- The staff code is first validated by `GET /api/admin?action=operations`. A failed request leaves the admin locked.
- The code is held in React state only for the lifetime of the page, and sent to the same-origin legacy iframe using an origin-checked parent message. Legacy modules read the code from ephemeral in-page memory.
- No staff code is saved to `localStorage` or `sessionStorage`. The existing server checks `PLP_STAFF_CODE` on every API action.
- `/admin` and `/admin-ops.html` remain `noindex` and are not added to the public sitemap or navigation.
- Both modes currently share one PLP staff authorization boundary. **This is not per-user RBAC or an owner-only access tier**. Introducing individual staff roles or additional tenants requires independently reviewed server authorization, tenant ownership predicates and migration work.
- Existing admin payment mutations and verification semantics have not been changed.

## Unconnected features

- Vision displays an unconnected state until the camera endpoint and access policy are verified.
- Pandora AI/local phone models and its autonomous command routing are not bundled into the resort's Vite website.
- Role invitations, new tenant creation, and cross-tenant management are not offered; this site is dedicated to Pueblo La Perla Boracay.

## Verification

Run `npm test`, `npm run build`, `npm run check:viewport`, and `npm run check:routes`. The last command checks the deployed site, not an unmerged branch. Live verification of `/admin` requires the configured `PLP_STAFF_CODE`; never include the code in Git, logs, tests or screenshots.
