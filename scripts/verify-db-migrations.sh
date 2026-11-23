#!/usr/bin/env bash
# Rebuilds the PLP database from migrations in a DISPOSABLE PostgreSQL database and runs the
# booking/payment behaviour checks. Never point this at production: Supabase-hosted URLs are refused.
#
#   PLP_VERIFY_DATABASE_URL=postgres://postgres:postgres@localhost:5432/plp_verify npm run verify:db
#
# Order: supabase/migrations/* plus the two reconciliation files in supabase/pending/
# (20261015100000 core booking baseline, 20261015100100 schema relocation), sorted by version,
# then every other pending file, then the baseline again (proves it is idempotent), then the checks.
set -euo pipefail
URL="${PLP_VERIFY_DATABASE_URL:?Set PLP_VERIFY_DATABASE_URL to a disposable database}"
case "$URL" in *supabase.co*|*supabase.com*|*supabase.net*) echo "Refusing: this looks like a Supabase-hosted database." >&2; exit 2;; esac
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
run() { psql "$URL" -v ON_ERROR_STOP=1 -q "$@"; }

# Minimal stand-ins for what a Supabase project provides (roles, auth.users, storage tables).
run <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as 'select null::uuid';
create or replace function auth.role() returns text language sql stable as 'select null::text';
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
SQL

BASELINE="$DIR/supabase/pending/20261015100000_plp_core_booking_baseline.sql"
FILES=$( (ls "$DIR"/supabase/migrations/*.sql; ls "$DIR"/supabase/pending/2026101510*.sql) | awk -F/ '{print $NF"\t"$0}' | sort | cut -f2)
for f in $FILES; do echo "apply $(basename "$f")"; run -f "$f"; done
for f in "$DIR"/supabase/pending/*.sql; do
  case "$(basename "$f")" in 2026101510*|*rollback*) continue;; esac
  echo "apply pending $(basename "$f")"; run -f "$f"
done
echo "re-apply baseline (idempotency)"; run -f "$BASELINE"
run -f "$DIR/supabase/verify/booking_baseline_checks.sql"
