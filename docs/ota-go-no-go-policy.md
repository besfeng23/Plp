# OTA Go / No-Go Policy

## Green rules
Green requires score >= 85 and zero critical failures. Green means the admin data is ready for the next planning phase.

## Amber rules
Amber requires score >= 65 and zero critical failures. Amber allows cleanup planning but not connector implementation approval without operator review.

## Red rules
Red means score < 65 or at least one critical failure exists. Red blocks further OTA connector work until the blocker is resolved or explicitly documented by leadership.

## What “go” means
“Go” means PLP can proceed to the next planning phase, such as sandbox connector contracts or mock adapters.

## What “go” does not mean
“Go” does not mean live OTA sync can be enabled. It does not authorize credential entry, inventory publishing, reservation import automation, booking creation, cancellation, payment mutation, or guest messaging.

## Who approves next phase
Resort operations leadership and the technical maintainer must approve the next phase based on the dashboard result, validation evidence, and known risks.

## Why live sync requires a separate explicit phase
Live OTA sync changes operational risk: inventory can be oversold, guest records can be created, cancellations can affect revenue, and credentials must be protected. Those risks require a separate scoped phase, separate security review, and explicit approval.
