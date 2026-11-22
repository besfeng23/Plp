# PLP owner decision approvals

Doctora's verified owner session can approve or decline a saved decision. The operation is one database transaction: lock the decision, record the approval/decline, update the owner register status, create a staff task, and write an immutable approval event. A trigger records the task's creation and later status/assignment/due-date changes.

The staff task is written into the existing `plp_runtime.plp_staff_tasks` worklog so the existing Resort Command staff task panel can update it through its normal status API. The owner office shows task status and audit history.

**Assignee behavior:** the live `plp_staff_identities` directory was empty at implementation time. The UI therefore accepts a staff-member or responsible-team label and explicitly says this is not a verified login or automatic notification. If active identities are later provisioned, the UI offers only those active identities and the task stores the identity ID as well.

Due date is required and cannot be earlier than the current Boracay-local date. No booking, payment, guest, public offer, membership or residential status is changed by an owner decision. A decline creates a close-out/follow-up task rather than silently deleting the decision.

All approval and task event tables have RLS enabled, with service-role-only API access. The owner API revalidates the signed-in Doctora identity and request origin; browser callers cannot set owner IDs.
