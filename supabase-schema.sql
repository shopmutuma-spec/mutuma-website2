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
    currency text not null default 'GBP',
    status text not null default 'paid',
    customer_details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

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
