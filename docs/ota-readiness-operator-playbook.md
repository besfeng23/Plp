# OTA Readiness Operator Playbook

## How to run preflight
Open Resort Command, find “OTA Preflight & Operator Readiness,” and click “Run readiness preflight.” The action is read-only and will not connect to OTA systems.

## How to interpret score
- 85–100 with no critical failures: green.
- 65–84 with no critical failures: amber.
- Below 65 or any critical failure: red.

## What to do for red
Stop connector planning. Review critical failures first, especially direct booking protection, live-mode flags, credential-shaped fields, and missing required mapping tables.

## What to do for amber
Create operator tasks for warnings and high-severity cleanup items. Re-run preflight after mapping, conflict, and staff task cleanup.

## What to do for green
Export or summarize the run for the Phase 2F planning record. Green permits only the next planning phase; it does not permit live OTA connectivity.

## How to clear missing mapping blockers
Open the OTA Room & Rate Mapping Workspace. Add or update review-only room mappings and rate mappings with OTA identifiers/names where known. Keep mappings in approved/review statuses only when operator-reviewed.

## How to clear conflict blockers
Open the OTA Conflict Console. Resolve or explicitly ignore stale conflicts with operator notes. Do not cancel direct or OTA bookings from preflight.

## How to handle route/deployment warnings
Route verification warnings mean the local/admin preflight cannot prove deployed availability. Verify the deployed admin route separately after migration and deployment.

## Escalation steps
Escalate critical direct-booking overlap, credential exposure, live-mode flags, and payment/booking concerns to the technical maintainer before any further OTA work.
