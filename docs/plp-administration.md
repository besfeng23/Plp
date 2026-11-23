# PLP Administration

`/admin` is the single PLP administration shell (`src/admin/PlpAdminApp.jsx`, navigation in `src/admin/adminNavigation.js`).
It replaces the former two-mode shell ("Manage Client" iframe of `/admin-ops.html` + "Client Workspace").

- **Eight screens:** Today · Reservations · Calendar · Guests & Requests · Pearl Club · Growth & Marketing · Reports & Documents · People & Access.
- **Permissions:** every tile needs one permission from `lib/access-control.js`. `GET /api/admin?action=session` returns the
  signed-in role and permissions; the shared staff code (`legacy`) keeps the full operational view except access management.
- **Operations kept:** booking confirmation (`booking-status`, only when the deposit is verified), date blocks (create/reopen),
  staff and housekeeping tasks (create/complete), concierge inbox, guest directory, notifications, monthly report, website
  funnel/analytics, Pearl Club register and workbook, system status.
- **Hidden, not deleted:** Channel Sync / OTA tooling and the Vision camera placeholder. `/admin-ops.html` and its scripts
  and all OTA APIs remain in the repository and reachable only by direct URL with staff access (noindex) for restricted
  advanced use; nothing in the administration links to them.
- **Owner Office:** `/owner` stays the owners' private documents and decisions space, linked from Reports & Documents
  (owners) and linking back to `/admin`.
- **Rollback:** revert the PR 6 squash commit; no API, table or data was changed by the UI consolidation.
