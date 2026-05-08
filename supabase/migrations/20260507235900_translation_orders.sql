-- Translation orders table
-- Stores every completed wizard session where user signed the certification.

create table if not exists public.translation_orders (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  email         text not null,
  phone         text,
  address       text,
  plan          text not null check (plan in ('basic', 'plus', 'premium')),
  spanish_copy  boolean not null default false,
  locale        text not null default 'en',
  signed_at     timestamptz,
  signature_method text check (signature_method in ('drawn_on_screen', 'manual_wet_signature')),
  certification_version text,
  status        text not null default 'signed' check (status in ('signed', 'emailed', 'failed')),
  stripe_checkout_id text
);

-- RLS: only service role can access
alter table public.translation_orders enable row level security;

create policy "Service role only" on public.translation_orders
  using (false);

-- Index for admin queries
create index if not exists translation_orders_email_idx on public.translation_orders (email);
create index if not exists translation_orders_created_at_idx on public.translation_orders (created_at desc);
