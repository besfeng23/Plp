-- The resort desk owns these enquiries. Club interest never creates a club member or an RSVP.
create schema if not exists plp_runtime;
grant usage on schema plp_runtime to service_role;
create table plp_runtime.plp_concierge_enquiries (
  id uuid primary key,
  topic text not null check (topic in ('stay','group','arrival','water','wellness','dining','club','club-activity','returning')),
  interest text not null check (length(interest) between 1 and 120),
  name text not null check (length(name) between 1 and 120),
  email text not null check (length(email) between 3 and 180),
  message text not null check (length(message) between 1 and 1200),
  status text not null default 'NEW' check (status in ('NEW','IN_PROGRESS','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plp_concierge_enquiries_queue on plp_runtime.plp_concierge_enquiries(status,created_at desc,id desc);
create index plp_concierge_enquiries_email_time on plp_runtime.plp_concierge_enquiries(email,created_at desc);
alter table plp_runtime.plp_concierge_enquiries enable row level security;
revoke all on plp_runtime.plp_concierge_enquiries from public,anon,authenticated,service_role;
grant select, update(status,updated_at) on plp_runtime.plp_concierge_enquiries to service_role;

create function plp_runtime.receive_concierge_enquiry(p_id uuid,p_topic text,p_interest text,p_name text,p_email text,p_message text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  saved plp_runtime.plp_concierge_enquiries%rowtype;
begin
  -- One retry identity per submission. Serializing by email also makes the send limit atomic.
  p_email := lower(trim(p_email));
  perform pg_advisory_xact_lock(hashtextextended(p_email,0));
  select * into saved from plp_runtime.plp_concierge_enquiries where id=p_id;
  if found then
    if (saved.topic,saved.interest,saved.name,saved.email,saved.message)
       is distinct from (p_topic,p_interest,p_name,p_email,p_message) then raise exception using errcode='P4201'; end if;
    return p_id;
  end if;
  if (select count(*) from plp_runtime.plp_concierge_enquiries where email=p_email and created_at > now()-interval '1 hour') >= 5
    then raise exception using errcode='P4202'; end if;
  insert into plp_runtime.plp_concierge_enquiries(id,topic,interest,name,email,message)
    values(p_id,p_topic,p_interest,p_name,p_email,p_message);
  return p_id;
end;
$$;
revoke all on function plp_runtime.receive_concierge_enquiry(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function plp_runtime.receive_concierge_enquiry(uuid,text,text,text,text,text) to service_role;
