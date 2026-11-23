-- PENDING OWNER APPROVAL — NOT APPLIED TO PRODUCTION.
-- Kept outside supabase/migrations so no integration applies it automatically.
-- To apply (only after explicit owner approval): review, take a backup, move
-- this file into supabase/migrations/ and apply it to the PLP project.
-- Additive only: creates two new tables; touches no existing data.
-- Rollback: drop table plp_runtime.plp_staff_access_events; drop table plp_runtime.plp_staff_roles;

create table if not exists plp_runtime.plp_staff_roles (
  email text primary key check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and length(email) <= 180),
  display_name text check (display_name is null or length(display_name) <= 120),
  -- Owners are never stored here: they come only from the PLP_OWNER_EMAILS allow-list.
  role text not null check (role in ('manager','staff')),
  active boolean not null default true,
  granted_by uuid not null,
  granted_by_email text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  updated_at timestamptz not null default now(),
  check ((active and revoked_at is null) or (not active and revoked_at is not null))
);
alter table plp_runtime.plp_staff_roles enable row level security;
revoke all on plp_runtime.plp_staff_roles from public, anon, authenticated;
grant select, insert, update on plp_runtime.plp_staff_roles to service_role;

create table if not exists plp_runtime.plp_staff_access_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  actor_email text not null,
  action text not null check (action in ('granted','revoked')),
  target_email text not null,
  role text check (role is null or role in ('manager','staff')),
  created_at timestamptz not null default now()
);
create index if not exists plp_staff_access_events_by_target on plp_runtime.plp_staff_access_events(target_email, created_at desc);
alter table plp_runtime.plp_staff_access_events enable row level security;
revoke all on plp_runtime.plp_staff_access_events from public, anon, authenticated;
-- Append-only audit: no update or delete grants.
grant select, insert on plp_runtime.plp_staff_access_events to service_role;
