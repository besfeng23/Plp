# OTA Dry Run Validation Checklist

- [ ] Preflight: confirm branch and diff scope.
- [ ] Supabase migration applied: Phase 1N before Phase 2A.
- [ ] Admin shell loads.
- [ ] OTA readiness loads.
- [ ] Dry-run endpoint rejects invalid dates.
- [ ] Dry-run endpoint rejects live mode.
- [ ] Dry-run returns no live writes.
- [ ] Manual blocks produce `would_close_inventory`.
- [ ] Active direct bookings produce `would_close_inventory`.
- [ ] Missing mappings produce `skip_mapping_not_ready`.
- [ ] Disabled channels produce `skip_channel_disabled`.
- [ ] Conflicts produce `needs_review`.
- [ ] Event row is created.
- [ ] No public booking behavior changed.
- [ ] No payment behavior changed.
