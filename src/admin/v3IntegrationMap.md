# Admin v3 integration map

Current live entry:

- `src/admin/main.jsx` renders `OpsAdminApp.jsx`.
- `OpsAdminApp.jsx` is records-first and should remain the runtime until each v3 module is wired safely.

Staged v3 modules:

- `v3ReservationsView.jsx` → replace the current Reservations/Bookings table.
- `v3PaymentsView.jsx` → replace the current Payments/Exceptions table.
- `v3AvailabilityView.jsx` or `v3RoomsView.jsx` → replace the Availability placeholder.
- `v3GuestsView.jsx` → replace the Guests placeholder.
- `v3ContentStudioView.jsx` → replace the Content placeholder.
- `v3SettingsView.jsx` → replace the Settings placeholder.
- `v3RatesPolicyView.jsx` → can be used under Settings or a future Rates section.

Data inputs already available in `OpsAdminApp.jsx`:

- `rows` from `operations.rows`
- `exceptions` from `operations.exceptions`
- `notifications` from `notifications.rows`
- `query`
- `filteredRows`
- `filteredExceptions`
- `filteredNotifications`

Safe replacement targets in `OpsAdminApp.jsx`:

- `activeTab === 'bookings'` → `<V3ReservationsView rows={filteredRows} onOpen={setSelectedRow} />`
- `activeTab === 'exceptions'` → `<V3PaymentsView rows={rows} exceptions={filteredExceptions} />`
- `activeTab === 'availability'` → `<V3AvailabilityView rows={rows} blocks={[]} />`
- `activeTab === 'guests'` → `<V3GuestsView rows={rows} />`
- `activeTab === 'content'` → `<V3ContentStudioView rows={[]} />`
- `activeTab === 'settings'` → `<V3SettingsView />`

Keep action controls separate until the read-only experience is stable.
