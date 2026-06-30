-- Phase 2E: OTA Preflight & Operator Readiness Dashboard
-- Readiness-check only. A green score does not enable live OTA sync.
-- Live OTA integrations require a separate approved phase.

create table if not exists public.plp_ota_preflight_runs (
  id uuid primary key default gen_random_uuid(),
  run_status text not null default 'completed',
  readiness_score integer not null default 0,
  readiness_grade text not null default 'red',
  go_no_go text not null default 'no_go',
  total_checks integer not null default 0,
  passed_checks integer not null default 0,
  warning_checks integer not null default 0,
  failed_checks integer not null default 0,
  critical_failures integer not null default 0,
  check_summary jsonb not null default '{}'::jsonb,
  channel_summary jsonb not null default '{}'::jsonb,
  operator_note text,
  created_by text,
  created_at timestamptz not null default now(),
  constraint plp_ota_preflight_runs_status_check check (run_status in ('completed', 'failed')),
  constraint plp_ota_preflight_runs_grade_check check (readiness_grade in ('green', 'amber', 'red')),
  constraint plp_ota_preflight_runs_go_no_go_check check (go_no_go in ('go', 'conditional_go', 'no_go'))
);

comment on table public.plp_ota_preflight_runs is 'Phase 2E admin-only OTA preflight readiness runs. Readiness-check only; green does not enable live OTA sync.';

create table if not exists public.plp_ota_preflight_check_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.plp_ota_preflight_runs(id) on delete cascade,
  category text not null,
  channel_key text,
  check_key text not null,
  check_label text not null,
  check_status text not null,
  severity text not null default 'medium',
  detail text,
  recommendation text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint plp_ota_preflight_items_status_check check (check_status in ('pass', 'warning', 'fail', 'blocked', 'not_applicable')),
  constraint plp_ota_preflight_items_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint plp_ota_preflight_items_category_check check (category in ('database','channel','room_mapping','rate_mapping','reservation_review','conflict_resolution','manual_blocks','staff_tasks','security','operations','deployment'))
);

comment on table public.plp_ota_preflight_check_items is 'Phase 2E admin-only OTA readiness check items. No OTA API, booking, payment, or guest-message action is performed.';

create index if not exists plp_ota_preflight_runs_created_at_idx on public.plp_ota_preflight_runs (created_at desc);
create index if not exists plp_ota_preflight_runs_go_no_go_idx on public.plp_ota_preflight_runs (go_no_go);
create index if not exists plp_ota_preflight_runs_grade_idx on public.plp_ota_preflight_runs (readiness_grade);
create index if not exists plp_ota_preflight_items_run_id_idx on public.plp_ota_preflight_check_items (run_id);
create index if not exists plp_ota_preflight_items_category_idx on public.plp_ota_preflight_check_items (category);
create index if not exists plp_ota_preflight_items_channel_idx on public.plp_ota_preflight_check_items (channel_key);
create index if not exists plp_ota_preflight_items_status_idx on public.plp_ota_preflight_check_items (check_status);
create index if not exists plp_ota_preflight_items_severity_idx on public.plp_ota_preflight_check_items (severity);

alter table public.plp_ota_preflight_runs enable row level security;
alter table public.plp_ota_preflight_check_items enable row level security;

create or replace view public.plp_ota_preflight_latest_summary as
select
  id as latest_run_id,
  created_at as latest_run_at,
  readiness_score,
  readiness_grade,
  go_no_go,
  total_checks,
  passed_checks,
  warning_checks,
  failed_checks,
  critical_failures
from public.plp_ota_preflight_runs
order by created_at desc
limit 1;

comment on view public.plp_ota_preflight_latest_summary is 'Latest Phase 2E OTA preflight summary. Green means ready for next planning phase only, not live sync.';
