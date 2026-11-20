-- Depends on 20261120174220_plp_club_boracay_members_activities.sql.
-- Check-in records describe actual attendance at an activity, never a public RSVP.
create table public.plp_club_attendance (
  activity_id uuid not null references public.plp_club_activities(id),
  member_id uuid not null references public.plp_club_members(id),
  present boolean not null,
  updated_at timestamptz not null default now(),
  primary key (activity_id, member_id)
);
alter table public.plp_club_attendance enable row level security;
revoke all on public.plp_club_attendance from public, anon, authenticated, service_role;
grant select on public.plp_club_attendance to service_role;

create function public.plp_club_record_attendance(p_activity uuid, p_member uuid, p_present boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  activity public.plp_club_activities%rowtype;
  member public.plp_club_members%rowtype;
  already_present boolean;
begin
  if p_present is null then raise exception using errcode = 'P4100'; end if;
  -- Serialize concurrent check-ins and activity edits before counting places.
  select * into activity from public.plp_club_activities
    where id = p_activity and chapter_code = 'boracay' for update;
  if not found then raise exception using errcode = 'P4101'; end if;
  select * into member from public.plp_club_members
    where id = p_member and chapter_code = activity.chapter_code for share;
  if not found then raise exception using errcode = 'P4101'; end if;
  select present into already_present from public.plp_club_attendance
    where activity_id = p_activity and member_id = p_member;
  if coalesce(already_present, false) = p_present then return p_present; end if;

  if p_present then
    if member.status <> 'ACTIVE' or activity.status <> 'PUBLISHED' or activity.starts_at > now()
      then raise exception using errcode = 'P4102'; end if;
    if activity.capacity is not null and
       (select count(*) from public.plp_club_attendance where activity_id = p_activity and present) >= activity.capacity
      then raise exception using errcode = 'P4103'; end if;
  end if;
  insert into public.plp_club_attendance (activity_id, member_id, present)
    values (p_activity, p_member, p_present)
    on conflict (activity_id, member_id) do update set present = excluded.present, updated_at = now();
  return p_present;
end;
$$;
revoke all on function public.plp_club_record_attendance(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.plp_club_record_attendance(uuid, uuid, boolean) to service_role;
