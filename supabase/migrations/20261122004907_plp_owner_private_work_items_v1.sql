-- PLP owner private work register. Applied to production as migration 20261122004907.
create table if not exists plp_runtime.plp_owner_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  kind text not null default 'decision' check (kind in ('decision','document','note','partner','milestone')),
  chapter text not null default 'boracay' check (chapter in ('boracay','singapore','malaysia','global')),
  title text not null check (length(btrim(title)) between 1 and 160),
  details text not null default '' check (length(details) <= 2000),
  reference_url text check (reference_url is null or (length(reference_url) <= 1000 and reference_url ~ '^https://[^[:space:]]+$')),
  status text not null default 'needs_decision' check (status in ('needs_decision','needs_verification','reviewed','archived')),
  priority text not null default 'normal' check (priority in ('normal','high')),
  due_on date,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plp_owner_items_by_owner on plp_runtime.plp_owner_items(owner_id, updated_at desc, id);
create index if not exists plp_owner_items_by_chapter on plp_runtime.plp_owner_items(chapter,status);
alter table plp_runtime.plp_owner_items enable row level security;
revoke all on plp_runtime.plp_owner_items from public, anon, authenticated;
grant select, insert, update on plp_runtime.plp_owner_items to service_role;
create table if not exists plp_runtime.plp_owner_item_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references plp_runtime.plp_owner_items(id) on delete restrict,
  owner_id uuid not null,
  action text not null check (action in ('created','updated')),
  previous_status text,
  new_status text not null,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists plp_owner_item_events_by_item on plp_runtime.plp_owner_item_events(item_id,created_at desc);
alter table plp_runtime.plp_owner_item_events enable row level security;
revoke all on plp_runtime.plp_owner_item_events from public, anon, authenticated;
grant select, insert on plp_runtime.plp_owner_item_events to service_role;
create or replace function plp_runtime.audit_owner_item_change()
returns trigger language plpgsql security invoker
set search_path=pg_catalog,plp_runtime as $$
begin
  insert into plp_runtime.plp_owner_item_events
    (item_id,owner_id,action,previous_status,new_status,actor_id)
  values (new.id,new.owner_id,case when tg_op='INSERT' then 'created' else 'updated' end,
    case when tg_op='INSERT' then null else old.status end,new.status,new.updated_by);
  return new;
end $$;
revoke all on function plp_runtime.audit_owner_item_change() from public, anon, authenticated;
grant execute on function plp_runtime.audit_owner_item_change() to service_role;
drop trigger if exists plp_owner_items_audit on plp_runtime.plp_owner_items;
create trigger plp_owner_items_audit after insert or update on plp_runtime.plp_owner_items
for each row execute function plp_runtime.audit_owner_item_change();
