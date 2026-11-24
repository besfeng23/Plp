-- Lean invite-only affiliate ledger. Four new tables only. Commission
-- calculation stays off until PLP_AFFILIATE_COMMISSIONS_ACTIVE=true and the
-- owner approves rates. Payouts are manual records; no bank or TIN fields.

create table if not exists plp_runtime.plp_affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  email text not null check (length(email) between 3 and 180),
  referral_code text not null check (referral_code ~ '^[a-z0-9][a-z0-9-]{2,31}$'),
  tier text not null check (tier in ('travel_agent','influencer','referral')),
  rate numeric(6,4) not null check (rate >= 0 and rate <= 1),
  rate_approval_status text not null default 'pending_owner_approval'
    check (rate_approval_status in ('pending_owner_approval','approved','rejected')),
  manager_affiliate_id uuid references plp_runtime.plp_affiliates(id) on delete set null,
  override_rate numeric(6,4) not null default 0 check (override_rate >= 0 and override_rate <= 1),
  status text not null default 'pending' check (status in ('pending','active','paused','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email),
  unique (referral_code)
);

create table if not exists plp_runtime.plp_affiliate_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) between 3 and 180),
  name text,
  tier text not null default 'referral' check (tier in ('travel_agent','influencer','referral')),
  token_hash text not null unique,
  invited_by text,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  affiliate_id uuid references plp_runtime.plp_affiliates(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists plp_runtime.plp_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references plp_runtime.plp_affiliates(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  payout_reference text,
  status text not null default 'recorded' check (status in ('recorded','cancelled')),
  recorded_by text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists plp_runtime.plp_commissions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references plp_runtime.plp_bookings(id) on delete restrict,
  affiliate_id uuid not null references plp_runtime.plp_affiliates(id) on delete restrict,
  commission_type text not null check (commission_type in ('referral','manager_override')),
  rate_snapshot numeric(6,4) not null,
  eligible_amount numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending','payable','approved','reversed','paid')),
  payout_id uuid references plp_runtime.plp_payouts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table plp_runtime.plp_bookings
  add column if not exists affiliate_id uuid references plp_runtime.plp_affiliates(id) on delete set null,
  add column if not exists referral_code text,
  add column if not exists balance_paid_at timestamptz,
  add column if not exists net_room_revenue numeric(12,2),
  add column if not exists currency text default 'USD';

alter table plp_runtime.plp_concierge_enquiries
  add column if not exists affiliate_id uuid references plp_runtime.plp_affiliates(id) on delete set null,
  add column if not exists referral_code text,
  add column if not exists referral_audit jsonb not null default '[]'::jsonb;

revoke all on plp_runtime.plp_affiliates, plp_runtime.plp_affiliate_invites,
  plp_runtime.plp_commissions, plp_runtime.plp_payouts
  from public, anon, authenticated, service_role;

alter table plp_runtime.plp_affiliates enable row level security;
alter table plp_runtime.plp_affiliate_invites enable row level security;
alter table plp_runtime.plp_commissions enable row level security;
alter table plp_runtime.plp_payouts enable row level security;

grant select, insert, update on plp_runtime.plp_affiliates, plp_runtime.plp_affiliate_invites,
  plp_runtime.plp_commissions, plp_runtime.plp_payouts to service_role;

grant update(affiliate_id, referral_code, referral_audit)
  on plp_runtime.plp_concierge_enquiries to service_role;

create index if not exists plp_affiliates_status_idx on plp_runtime.plp_affiliates (status, created_at desc);
create index if not exists plp_bookings_affiliate_idx on plp_runtime.plp_bookings (affiliate_id) where affiliate_id is not null;
create index if not exists plp_enquiries_affiliate_idx on plp_runtime.plp_concierge_enquiries (affiliate_id) where affiliate_id is not null;
create index if not exists plp_commissions_affiliate_idx on plp_runtime.plp_commissions (affiliate_id, status);
