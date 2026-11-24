-- Durable store for private-preview code failures and owner-god sign-in
-- audits. The access code itself is never stored. Used to rate-limit failed
-- attempts (5 per 15 minutes per IP hash) with a sliding lockout.

create table if not exists plp_runtime.plp_preview_gate_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('fail', 'owner_god_signin')),
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists plp_preview_gate_events_ip_kind_created_idx
  on plp_runtime.plp_preview_gate_events (ip_hash, kind, created_at desc);

revoke all on plp_runtime.plp_preview_gate_events
  from public, anon, authenticated, service_role;

alter table plp_runtime.plp_preview_gate_events enable row level security;

grant select, insert on plp_runtime.plp_preview_gate_events to service_role;
