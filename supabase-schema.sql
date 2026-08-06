create extension if not exists pgcrypto;

create table if not exists public.subscribers (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    source text not null default 'website',
    stripe_session_id text,
    subscribed_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.subscribers enable row level security;

drop policy if exists "No public subscriber reads" on public.subscribers;

create policy "No public subscriber reads"
on public.subscribers
for select
to anon, authenticated
using (false);

drop policy if exists "No public subscriber writes" on public.subscribers;

create policy "No public subscriber writes"
on public.subscribers
for insert
to anon, authenticated
with check (false);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists subscribers_set_updated_at on public.subscribers;

create trigger subscribers_set_updated_at
before update on public.subscribers
for each row
execute function public.set_updated_at();

create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    stripe_session_id text not null unique,
    order_number text not null unique,
    email text not null,
    name text,
    total numeric,
    currency text not null default 'USD',
    status text not null default 'paid',
    tracking_courier text,
    tracking_number text,
    admin_notes text,
    order_items jsonb not null default '[]'::jsonb,
    customer_details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.orders
add column if not exists tracking_courier text,
add column if not exists tracking_number text,
add column if not exists admin_notes text,
add column if not exists order_items jsonb not null default '[]'::jsonb;

alter table public.orders enable row level security;

drop policy if exists "No public order reads" on public.orders;

create policy "No public order reads"
on public.orders
for select
to anon, authenticated
using (false);

drop policy if exists "No public order writes" on public.orders;

create policy "No public order writes"
on public.orders
for insert
to anon, authenticated
with check (false);

drop trigger if exists orders_set_updated_at on public.orders;

create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

create table if not exists public.analytics_events (
    id uuid primary key default gen_random_uuid(),
    event_name text not null,
    session_id text,
    page_path text,
    product_id text,
    product_name text,
    search_query text,
    currency text,
    value numeric,
    metadata jsonb not null default '{}'::jsonb,
    user_agent text,
    country text,
    created_at timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

create table if not exists public.catalog_products (
    id text primary key,
    name text not null,
    description text not null default '',
    category text not null default 'Decor',
    price numeric not null,
    old_price numeric,
    currency text not null default 'USD',
    image_url text not null,
    tags text[] not null default '{}'::text[],
    stock integer,
    featured boolean not null default false,
    published boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.catalog_products enable row level security;

create policy "No public catalog product writes"
on public.catalog_products
for insert
to anon, authenticated
with check (false);

create policy "No public catalog product updates"
on public.catalog_products
for update
to anon, authenticated
using (false)
with check (false);

create policy "No public catalog product deletes"
on public.catalog_products
for delete
to anon, authenticated
using (false);

drop trigger if exists catalog_products_set_updated_at on public.catalog_products;

create trigger catalog_products_set_updated_at
before update on public.catalog_products
for each row
execute function public.set_updated_at();

create table if not exists public.store_offers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    discount_percent numeric not null,
    scope text not null default 'all',
    enabled boolean not null default true,
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.store_offers enable row level security;

create policy "No public offer writes"
on public.store_offers
for insert
to anon, authenticated
with check (false);

create policy "No public offer updates"
on public.store_offers
for update
to anon, authenticated
using (false)
with check (false);

create policy "No public offer deletes"
on public.store_offers
for delete
to anon, authenticated
using (false);

drop trigger if exists store_offers_set_updated_at on public.store_offers;

create trigger store_offers_set_updated_at
before update on public.store_offers
for each row
execute function public.set_updated_at();

insert into public.store_offers (name, discount_percent, scope, enabled)
select '30% off everything', 30, 'all', true
where not exists (
    select 1 from public.store_offers where name = '30% off everything'
);

drop policy if exists "No public analytics reads" on public.analytics_events;

create policy "No public analytics reads"
on public.analytics_events
for select
to anon, authenticated
using (false);

drop policy if exists "No public analytics writes" on public.analytics_events;

create policy "No public analytics writes"
on public.analytics_events
for insert
to anon, authenticated
with check (false);

create index if not exists analytics_events_created_at_idx
on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_name_idx
on public.analytics_events (event_name);

create index if not exists analytics_events_session_idx
on public.analytics_events (session_id);

create index if not exists analytics_events_product_idx
on public.analytics_events (product_id);

create index if not exists orders_created_at_idx
on public.orders (created_at desc);

create index if not exists orders_email_idx
on public.orders (email);

create table if not exists public.product_costs (
    id uuid primary key default gen_random_uuid(),
    product_id text not null unique,
    product_cost numeric,
    fulfilment_cost numeric,
    shipping_cost numeric,
    supplier text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.product_costs enable row level security;

drop policy if exists "No public product cost reads" on public.product_costs;

create policy "No public product cost reads"
on public.product_costs
for select
to anon, authenticated
using (false);

drop policy if exists "No public product cost writes" on public.product_costs;

create policy "No public product cost writes"
on public.product_costs
for insert
to anon, authenticated
with check (false);

drop trigger if exists product_costs_set_updated_at on public.product_costs;

create trigger product_costs_set_updated_at
before update on public.product_costs
for each row
execute function public.set_updated_at();

create table if not exists public.business_goals (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    metric text not null,
    target_value numeric not null,
    period text not null default 'monthly',
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.business_goals enable row level security;

drop policy if exists "No public business goal reads" on public.business_goals;

create policy "No public business goal reads"
on public.business_goals
for select
to anon, authenticated
using (false);

drop policy if exists "No public business goal writes" on public.business_goals;

create policy "No public business goal writes"
on public.business_goals
for insert
to anon, authenticated
with check (false);

drop trigger if exists business_goals_set_updated_at on public.business_goals;

create trigger business_goals_set_updated_at
before update on public.business_goals
for each row
execute function public.set_updated_at();

create table if not exists public.admin_audit_log (
    id uuid primary key default gen_random_uuid(),
    admin_email text,
    action text not null,
    entity_type text,
    entity_id text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

drop policy if exists "No public admin audit reads" on public.admin_audit_log;

create policy "No public admin audit reads"
on public.admin_audit_log
for select
to anon, authenticated
using (false);

drop policy if exists "No public admin audit writes" on public.admin_audit_log;

create policy "No public admin audit writes"
on public.admin_audit_log
for insert
to anon, authenticated
with check (false);
