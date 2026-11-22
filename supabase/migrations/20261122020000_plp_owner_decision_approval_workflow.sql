-- PLP Doctora owner decisions create auditable staff work items.
alter table plp_runtime.plp_owner_items
  drop constraint if exists plp_owner_items_status_check;
alter table plp_runtime.plp_owner_items
  add constraint plp_owner_items_status_check
  check (status in ('needs_decision','needs_verification','reviewed','approved','declined','archived'));

alter table plp_runtime.plp_staff_tasks
  add column if not exists assigned_to_label text,
  add column if not exists assigned_to_identity uuid references plp_runtime.plp_staff_identities(id),
  add column if not exists due_on date;

create table if not exists plp_runtime.plp_owner_decision_approvals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  item_id uuid not null references plp_runtime.plp_owner_items(id) on delete restrict,
  decision text not null check (decision in ('approved','declined')),
  notes text not null default '' check (length(notes) <= 1200),
  assigned_to_label text not null check (length(btrim(assigned_to_label)) between 1 and 120),
  assigned_to_identity uuid references plp_runtime.plp_staff_identities(id),
  due_on date not null,
  task_id uuid references plp_runtime.plp_staff_tasks(id) on delete restrict,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists plp_owner_approvals_by_owner on plp_runtime.plp_owner_decision_approvals(owner_id,created_at desc);
create index if not exists plp_owner_approvals_by_item on plp_runtime.plp_owner_decision_approvals(item_id,created_at desc);

alter table plp_runtime.plp_staff_tasks
  add column if not exists owner_approval_id uuid references plp_runtime.plp_owner_decision_approvals(id) on delete restrict;
create index if not exists plp_staff_tasks_owner_approval on plp_runtime.plp_staff_tasks(owner_approval_id);

create table if not exists plp_runtime.plp_owner_approval_events (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references plp_runtime.plp_owner_decision_approvals(id) on delete restrict,
  owner_id uuid not null,
  action text not null check (action in ('approved','declined')),
  decision text not null check (decision in ('approved','declined')),
  assigned_to_label text not null,
  due_on date not null,
  task_id uuid not null references plp_runtime.plp_staff_tasks(id) on delete restrict,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists plp_owner_approval_events_by_owner on plp_runtime.plp_owner_approval_events(owner_id,created_at desc);

create table if not exists plp_runtime.plp_staff_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references plp_runtime.plp_staff_tasks(id) on delete restrict,
  approval_id uuid not null references plp_runtime.plp_owner_decision_approvals(id) on delete restrict,
  owner_id uuid not null,
  action text not null check (action in ('created','status_changed','assignment_changed','due_date_changed')),
  previous_status text,
  new_status text,
  previous_assignee text,
  new_assignee text,
  previous_due_on date,
  new_due_on date,
  actor text,
  created_at timestamptz not null default now()
);
create index if not exists plp_staff_task_events_by_owner on plp_runtime.plp_staff_task_events(owner_id,created_at desc);
create index if not exists plp_staff_task_events_by_task on plp_runtime.plp_staff_task_events(task_id,created_at desc);

alter table plp_runtime.plp_owner_decision_approvals enable row level security;
alter table plp_runtime.plp_owner_approval_events enable row level security;
alter table plp_runtime.plp_staff_task_events enable row level security;
revoke all on plp_runtime.plp_owner_decision_approvals,plp_runtime.plp_owner_approval_events,plp_runtime.plp_staff_task_events from public,anon,authenticated;
grant select,insert,update on plp_runtime.plp_owner_decision_approvals to service_role;
grant select,insert on plp_runtime.plp_owner_approval_events to service_role;
grant select,insert on plp_runtime.plp_staff_task_events to service_role;
grant select,insert,update on plp_runtime.plp_staff_tasks to service_role;

create or replace function plp_runtime.audit_owner_staff_task_change()
returns trigger language plpgsql security invoker
set search_path=pg_catalog,plp_runtime
as $$
declare
  v_owner_id uuid;
  v_action text;
begin
  if new.owner_approval_id is null then return new; end if;
  select owner_id into v_owner_id from plp_runtime.plp_owner_decision_approvals where id=new.owner_approval_id;
  if v_owner_id is null then raise exception 'Approval task owner not found'; end if;
  if tg_op='INSERT' then
    v_action:='created';
  elsif old.status is distinct from new.status then
    v_action:='status_changed';
  elsif old.assigned_to_label is distinct from new.assigned_to_label
     or old.assigned_to_identity is distinct from new.assigned_to_identity then
    v_action:='assignment_changed';
  elsif old.due_on is distinct from new.due_on then
    v_action:='due_date_changed';
  else
    return new;
  end if;
  insert into plp_runtime.plp_staff_task_events
    (task_id,approval_id,owner_id,action,previous_status,new_status,previous_assignee,new_assignee,previous_due_on,new_due_on,actor)
  values
    (new.id,new.owner_approval_id,v_owner_id,v_action,
     case when tg_op='INSERT' then null else old.status end,new.status,
     case when tg_op='INSERT' then null else old.assigned_to_label end,new.assigned_to_label,
     case when tg_op='INSERT' then null else old.due_on end,new.due_on,new.actor);
  return new;
end $$;
revoke all on function plp_runtime.audit_owner_staff_task_change() from public,anon,authenticated;
grant execute on function plp_runtime.audit_owner_staff_task_change() to service_role;
drop trigger if exists plp_staff_tasks_owner_audit on plp_runtime.plp_staff_tasks;
create trigger plp_staff_tasks_owner_audit after insert or update on plp_runtime.plp_staff_tasks
for each row execute function plp_runtime.audit_owner_staff_task_change();

create or replace function plp_runtime.plp_owner_decide_and_assign(
  p_owner_id uuid,
  p_item_id uuid,
  p_decision text,
  p_assigned_to_label text,
  p_assigned_to_identity uuid,
  p_due_on date,
  p_notes text
)
returns jsonb language plpgsql security invoker
set search_path=pg_catalog,plp_runtime
as $$
declare
  v_item plp_runtime.plp_owner_items%rowtype;
  v_approval_id uuid;
  v_task_id uuid;
  v_task_title text;
  v_task_note text;
begin
  if p_decision not in ('approved','declined') then raise exception 'Invalid owner decision'; end if;
  if p_assigned_to_label is null or length(btrim(p_assigned_to_label)) not between 1 and 120
    or p_assigned_to_label ~ '[[:cntrl:]]' then raise exception 'A valid assignee is required'; end if;
  if p_due_on is null or p_due_on < (now() at time zone 'Asia/Manila')::date then raise exception 'A current or future due date is required'; end if;
  if length(coalesce(p_notes,'')) > 1200 then raise exception 'Owner instruction is too long'; end if;
  if p_assigned_to_identity is not null and not exists(
    select 1 from plp_runtime.plp_staff_identities where id=p_assigned_to_identity and active=true
  ) then raise exception 'Selected staff identity is not active'; end if;

  select * into v_item from plp_runtime.plp_owner_items
  where id=p_item_id and owner_id=p_owner_id and kind='decision'
  for update;
  if not found then raise exception 'Owner decision not found'; end if;
  if v_item.status not in ('needs_decision','needs_verification') then raise exception 'Owner decision already resolved'; end if;

  insert into plp_runtime.plp_owner_decision_approvals
    (owner_id,item_id,decision,notes,assigned_to_label,assigned_to_identity,due_on,actor_id)
  values
    (p_owner_id,v_item.id,p_decision,coalesce(p_notes,''),btrim(p_assigned_to_label),p_assigned_to_identity,p_due_on,p_owner_id)
  returning id into v_approval_id;

  update plp_runtime.plp_owner_items
  set status=p_decision,updated_at=now(),updated_by=p_owner_id
  where id=v_item.id and owner_id=p_owner_id;

  v_task_title := left(case when p_decision='approved' then 'Implement approved decision: ' else 'Close out declined decision: ' end || v_item.title,160);
  v_task_note := left('Owner decision: ' || upper(p_decision) || '. ' || coalesce(p_notes,''),1200);
  insert into plp_runtime.plp_staff_tasks
    (booking_reference,kind,category,priority,status,title,note,source,actor,due_on,assigned_to_label,assigned_to_identity,owner_approval_id)
  values
    ('OWNER-'||v_item.id::text,'task','admin',case when v_item.priority='high' then 'high' else 'normal' end,
     'open',v_task_title,v_task_note,'doctora-owner-office','Doctora',p_due_on,btrim(p_assigned_to_label),p_assigned_to_identity,v_approval_id)
  returning id into v_task_id;

  update plp_runtime.plp_owner_decision_approvals set task_id=v_task_id where id=v_approval_id;
  insert into plp_runtime.plp_owner_approval_events
    (approval_id,owner_id,action,decision,assigned_to_label,due_on,task_id,actor_id)
  values (v_approval_id,p_owner_id,p_decision,p_decision,btrim(p_assigned_to_label),p_due_on,v_task_id,p_owner_id);

  return jsonb_build_object('approval_id',v_approval_id,'task_id',v_task_id,'decision',p_decision,'task_status','open');
end $$;
revoke all on function plp_runtime.plp_owner_decide_and_assign(uuid,uuid,text,text,uuid,date,text) from public,anon,authenticated;
grant execute on function plp_runtime.plp_owner_decide_and_assign(uuid,uuid,text,text,uuid,date,text) to service_role;
