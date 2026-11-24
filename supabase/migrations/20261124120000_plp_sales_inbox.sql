-- Sales inbox: additive fields and statuses on the existing concierge enquiry desk.
-- Do not invent a parallel inquiries table. Existing request IDs remain the
-- idempotent "one lead per form submission" key.

alter table plp_runtime.plp_concierge_enquiries
  add column if not exists assignee text,
  add column if not exists follow_up_on date,
  add column if not exists alerted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'plp_concierge_enquiries_assignee_check'
      and conrelid = 'plp_runtime.plp_concierge_enquiries'::regclass
  ) then
    alter table plp_runtime.plp_concierge_enquiries
      add constraint plp_concierge_enquiries_assignee_check
      check (assignee is null or length(assignee) between 1 and 120);
  end if;
end $$;

alter table plp_runtime.plp_concierge_enquiries
  drop constraint if exists plp_concierge_enquiries_status_check;

alter table plp_runtime.plp_concierge_enquiries
  add constraint plp_concierge_enquiries_status_check
  check (status in ('NEW','CONTACTED','QUOTED','BOOKED','LOST','IN_PROGRESS','CLOSED'));

update plp_runtime.plp_concierge_enquiries set status = 'CONTACTED', updated_at = now()
  where status = 'IN_PROGRESS';
update plp_runtime.plp_concierge_enquiries set status = 'LOST', updated_at = now()
  where status = 'CLOSED';

alter table plp_runtime.plp_concierge_enquiries
  drop constraint plp_concierge_enquiries_status_check;

alter table plp_runtime.plp_concierge_enquiries
  add constraint plp_concierge_enquiries_status_check
  check (status in ('NEW','CONTACTED','QUOTED','BOOKED','LOST'));

revoke all on plp_runtime.plp_concierge_enquiries from public, anon, authenticated, service_role;
grant select, update(status, updated_at, assignee, follow_up_on, alerted_at)
  on plp_runtime.plp_concierge_enquiries to service_role;

create index if not exists plp_concierge_enquiries_follow_up
  on plp_runtime.plp_concierge_enquiries (follow_up_on)
  where follow_up_on is not null and status in ('NEW','CONTACTED','QUOTED');
