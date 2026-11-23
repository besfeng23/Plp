-- ARCHIVED. This migration was never applied to production and is not needed.
-- The standalone Growth Plan page was retired on 23 November 2026 (PHT).
-- Official social links and the four pending owner confirmations now live on
-- the Administration Growth & Marketing screen. Do not run this file.
--
-- Original location: supabase/pending/20261123070000_plp_growth_tasks.sql
-- Original purpose: shared Growth Plan task progress + append-only history.
--
-- PENDING OWNER APPROVAL — NOT APPLIED TO PRODUCTION.
-- Shared Growth Plan progress (plan PR 7). Kept outside supabase/migrations so no
-- integration applies it automatically. Additive only: two new tables, no existing data touched.
-- Until applied, /plp-growth-plan keeps progress in each browser, labelled "saved on this device".
-- Rollback: drop table plp_runtime.plp_growth_task_events; drop table plp_runtime.plp_growth_tasks;

create table if not exists plp_runtime.plp_growth_tasks (
  -- '01'..'26' = the V3 task register; 'post-0'..'post-13' = the content calendar.
  item_key text primary key check (item_key ~ '^(0[1-9]|1[0-9]|2[0-6]|post-([0-9]|1[0-3]))$'),
  status text not null check (status in ('Planned','Needs info','In progress','Blocked','Done','Proposed','Needs footage','Draft','Approved','Scheduled','Published','Paused')),
  note text check (note is null or length(note) <= 500),
  proof_url text check (proof_url is null or (length(proof_url) <= 1000 and proof_url ~ '^https://[^[:space:]]+$')),
  owner_label text check (owner_label is null or length(owner_label) <= 80),
  due_on date,
  completed_at timestamptz,
  updated_by uuid not null,
  updated_by_email text not null,
  updated_at timestamptz not null default now(),
  check (status <> 'Done' or length(coalesce(note, '')) >= 8),
  check (status <> 'Published' or proof_url is not null)
);
alter table plp_runtime.plp_growth_tasks enable row level security;
revoke all on plp_runtime.plp_growth_tasks from public, anon, authenticated;
grant select, insert, update on plp_runtime.plp_growth_tasks to service_role;

create table if not exists plp_runtime.plp_growth_task_events (
  id uuid primary key default gen_random_uuid(),
  item_key text not null,
  previous_status text,
  new_status text not null,
  actor_id uuid not null,
  actor_email text not null,
  created_at timestamptz not null default now()
);
create index if not exists plp_growth_task_events_by_item on plp_runtime.plp_growth_task_events(item_key, created_at desc);
alter table plp_runtime.plp_growth_task_events enable row level security;
revoke all on plp_runtime.plp_growth_task_events from public, anon, authenticated;
-- Append-only history: no update or delete.
grant select, insert on plp_runtime.plp_growth_task_events to service_role;
-- Supabase default privileges may also grant DELETE/TRUNCATE/UPDATE to service_role; remove them explicitly.
revoke delete, truncate on plp_runtime.plp_growth_tasks from service_role;
revoke update, delete, truncate on plp_runtime.plp_growth_task_events from service_role;
