-- PLP Club foundation: Boracay senior community first; SG/MY reserved for
-- separate chapter launches. No payments, government senior IDs or DOBs.
-- Public users cannot query these tables directly through Supabase Data API.

create table if not exists public.plp_club_chapters (
  code text primary key,
  country_code char(2) not null,
  label text not null,
  status text not null default 'PLANNED' check (status in ('PLANNED', 'PILOT', 'OPEN', 'PAUSED')),
  created_at timestamptz not null default now()
);

insert into public.plp_club_chapters (code, country_code, label, status)
values
  ('boracay', 'PH', 'PLP Club Boracay', 'PILOT'),
  ('singapore', 'SG', 'PLP Club Singapore', 'PLANNED'),
  ('malaysia', 'MY', 'PLP Club Malaysia', 'PLANNED')
on conflict (code) do nothing;

create table if not exists public.plp_club_members (
  id uuid primary key default gen_random_uuid(),
  chapter_code text not null references public.plp_club_chapters(code),
  full_name text not null check (length(full_name) between 2 and 140),
  email text not null check (length(email) between 5 and 180),
  phone text,
  age_declared_60plus boolean not null default false,
  consent_at timestamptz not null,
  consent_source text not null default 'staff_recorded' check (consent_source = 'staff_recorded'),
  status text not null default 'PENDING' check (status in ('PENDING', 'ACTIVE', 'DECLINED', 'INACTIVE')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plp_club_senior_declaration check (age_declared_60plus = true)
);

create unique index if not exists plp_club_member_chapter_email_unique
  on public.plp_club_members (chapter_code, lower(email));
create index if not exists plp_club_member_chapter_status_idx
  on public.plp_club_members (chapter_code, status, created_at desc);

create table if not exists public.plp_club_activities (
  id uuid primary key default gen_random_uuid(),
  chapter_code text not null references public.plp_club_chapters(code),
  title text not null check (length(title) between 1 and 120),
  summary text not null check (length(summary) between 1 and 600),
  category text not null check (category in ('connection', 'wellbeing', 'culture', 'island')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer check (capacity between 1 and 1000),
  location_note text,
  accessibility_notes text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plp_club_activity_times_check check (ends_at > starts_at)
);

create index if not exists plp_club_activity_public_calendar_idx
  on public.plp_club_activities (chapter_code, starts_at)
  where status = 'PUBLISHED';

-- RLS is defense in depth. Only server-side staff routes, via the existing
-- PLP server credential, may read/write these PII-bearing records.
alter table public.plp_club_chapters enable row level security;
alter table public.plp_club_members enable row level security;
alter table public.plp_club_activities enable row level security;

revoke all on table public.plp_club_chapters from anon, authenticated;
revoke all on table public.plp_club_members from anon, authenticated;
revoke all on table public.plp_club_activities from anon, authenticated;
grant select, insert, update on table public.plp_club_chapters to service_role;
grant select, insert, update on table public.plp_club_members to service_role;
grant select, insert, update on table public.plp_club_activities to service_role;
