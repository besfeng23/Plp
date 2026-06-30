-- Admin Phase 1I: persisted internal notes and staff tasks
-- Additive only. Does not touch booking, payment, webhook, or public booking tables.

create extension if not exists pgcrypto;

create table if not exists public.plp_staff_tasks (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null,
  kind text not null default 'task' check (kind in ('task', 'note')),
  category text not null default 'admin' check (category in ('concierge', 'housekeeping', 'payment', 'arrival', 'availability', 'admin')),
  priority text not null default 'normal' check (priority in ('high', 'medium', 'normal')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  title text not null,
  note text,
  source text not null default 'resort-command-admin',
  actor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_plp_staff_tasks_booking_reference on public.plp_staff_tasks (booking_reference);
create index if not exists idx_plp_staff_tasks_status on public.plp_staff_tasks (status);
create index if not exists idx_plp_staff_tasks_created_at on public.plp_staff_tasks (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_plp_staff_tasks_updated_at on public.plp_staff_tasks;
create trigger set_plp_staff_tasks_updated_at
before update on public.plp_staff_tasks
for each row
execute function public.set_updated_at();

alter table public.plp_staff_tasks enable row level security;

comment on table public.plp_staff_tasks is 'PLP admin-only persisted internal notes and staff tasks. Accessed through service-role admin API only.';
