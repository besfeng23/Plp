-- Pearl Club Boracay: real, pending online applications with applicant consent.
-- No charges, residential admissions, healthcare processing or automatic activation.
-- Run before opening the public application form. Existing staff records preserved.
begin;

alter table public.plp_club_members
  drop constraint if exists plp_club_members_consent_source_check;

alter table public.plp_club_members
  add constraint plp_club_members_consent_source_check
  check (consent_source in ('staff_recorded', 'applicant_web'));

-- The Pearl Club identity is approved; other chapters remain planned.
update public.plp_club_chapters
set label = 'Pearl Club Boracay'
where code = 'boracay' and label = 'PLP Club Boracay';

-- Do not change status to OPEN here. Activate only after the deployed
-- public API and staff review path have passed production verification.
alter table public.plp_club_members enable row level security;
revoke all on public.plp_club_members from anon, authenticated;
grant select, insert, update on public.plp_club_members to service_role;

commit;
