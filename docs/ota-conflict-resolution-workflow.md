# OTA Conflict Resolution Workflow

## Intake sources

Conflicts enter the console from `plp_ota_conflicts` and from staged OTA reservation imports with detected conflicts.

## Classification

The console classifies direct booking overlaps, manual block overlaps, duplicate imports, missing room mappings, invalid accommodations, payment ambiguity, disabled channels, and missing credentials.

## Status lifecycle

`open` → `in_review` → `waiting_on_guest` / `waiting_on_ota` / `waiting_on_staff` → `resolved` or `ignored`.

## Human decisions

Operators decide whether to maintain a direct booking, maintain a manual block, contact an OTA, contact a guest, update mappings, reject an import, archive a duplicate, or approve manual entry.

## Never automatic

The console never creates a booking, changes payment, sends guest communications, changes manual blocks, cancels records, or calls an OTA.
