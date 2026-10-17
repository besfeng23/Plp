-- PLP monthly site subscription records and cached PayPal plan configuration.
-- Serverless routes use the Supabase service-role key. Client roles cannot read
-- subscriber emails, PayPal IDs, or stored provider payloads.

create table if not exists public.plp_site_subscription_config (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.plp_site_subscriptions (
  provider_subscription_id text primary key,
  email text not null,
  full_name text not null,
  plan_id text not null,
  custom_id text not null,
  status text not null default 'APPROVAL_PENDING',
  amount_php numeric(12, 2) not null default 10000.00,
  currency text not null default 'PHP',
  next_billing_time timestamptz,
  last_verified_at timestamptz,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plp_site_subscriptions_amount_check check (amount_php = 10000.00),
  constraint plp_site_subscriptions_currency_check check (currency = 'PHP')
);

create index if not exists plp_site_subscriptions_email_idx
  on public.plp_site_subscriptions (lower(email));

create index if not exists plp_site_subscriptions_status_idx
  on public.plp_site_subscriptions (status, next_billing_time);

alter table public.plp_site_subscription_config enable row level security;
alter table public.plp_site_subscriptions enable row level security;

revoke all on table public.plp_site_subscription_config from anon, authenticated;
revoke all on table public.plp_site_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.plp_site_subscription_config to service_role;
grant select, insert, update, delete on table public.plp_site_subscriptions to service_role;
