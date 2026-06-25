-- PLP Phase 11 Analytics
-- Run this in Supabase SQL editor before relying on stored analytics events.

create table if not exists public.plp_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  page_path text,
  session_id text,
  payload jsonb not null default '{}'::jsonb,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists plp_analytics_events_created_at_idx
  on public.plp_analytics_events (created_at desc);

create index if not exists plp_analytics_events_event_name_idx
  on public.plp_analytics_events (event_name);

create index if not exists plp_analytics_events_page_path_idx
  on public.plp_analytics_events (page_path);

alter table public.plp_analytics_events enable row level security;

-- No public read access. Server-side service role writes through /api/analytics.
