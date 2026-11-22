## Temporary no-passcode owner-office preview (22 November 2026)

The `/owner` page now opens directly into an **unrestricted, read-only visual preview** of Doctora's Digital Private Office, without a passcode or automatic login prompt.

Security boundary: the public preview intentionally displays **no reservation counts, visitor records, membership information, payment/financial data, private decisions, or confidential documents**. All metric values are clearly unreported (—), not fabricated zeros. All pages shown are conceptual navigation and description only. No protected API is requested when the public preview mounts.

The original **verified owner email sign-in** remains available from the explicit *Open secure sign-in* button, and magic-link callback URLs continue to enter the sign-in flow. The signed HttpOnly owner cookie, exact confirmed-email check, server-side authorization on each report read, origin checks, and private/no-store headers are unchanged. The shared staff code still cannot access owner reports.

The public preview is deliberately not the live authenticated executive system. Supplying live owner data without authentication would publish confidential business information to anyone with the URL. To activate live reporting, Doctora must complete individual verified owner sign-in (or a separately vetted alternative).

No payment, subscription, booking, membership, or analytics tracking setting has been modified. No fake records seeded.
