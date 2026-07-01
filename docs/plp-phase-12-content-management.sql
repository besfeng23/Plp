-- PLP Phase 12 Content Management
-- Run in Supabase SQL editor before using /content-ops.html.

create table if not exists public.plp_site_content (
  id uuid primary key default gen_random_uuid(),
  section text not null unique,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  content jsonb not null default '{}'::jsonb,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plp_site_content_section_idx
  on public.plp_site_content (section);

create index if not exists plp_site_content_status_idx
  on public.plp_site_content (status);

create index if not exists plp_site_content_updated_at_idx
  on public.plp_site_content (updated_at desc);

alter table public.plp_site_content enable row level security;

-- No public table policies are required.
-- Public reads go through /api/content.
-- Staff writes go through /api/admin/content using the service role and PLP_STAFF_CODE.

insert into public.plp_site_content (section, status, content, updated_by)
values
  ('homepage', 'PUBLISHED', '{
    "heroTitle": "Pueblo La Perla",
    "heroSubtitle": "A private hillside retreat above Boracay’s white sands.",
    "primaryCta": "Reserve your stay"
  }'::jsonb, 'migration'),
  ('accommodation', 'PUBLISHED', '{
    "grandOceanVilla": { "name": "Grand Ocean Villa", "rate": 300, "capacity": 8, "bedrooms": 4 },
    "sunsetSuite": { "name": "Sunset Suite", "rate": 200, "capacity": 4, "bedrooms": 2 },
    "smartRoomPremium": { "name": "Smart Room Premium", "rate": 100, "capacity": 2, "bedrooms": 1 }
  }'::jsonb, 'migration'),
  ('experiences', 'PUBLISHED', '{
    "water": "Paraw sailing, island hopping, snorkeling, and curated water activities.",
    "wellness": "Quiet recovery days and rest-focused island rhythm.",
    "privateDining": "Sunset dinners, in-villa meals, and intimate celebration arrangements."
  }'::jsonb, 'migration'),
  ('policies', 'PUBLISHED', '{
    "reservationNote": "Final confirmation follows availability review and reservation completion."
  }'::jsonb, 'migration')
on conflict (section) do nothing;
