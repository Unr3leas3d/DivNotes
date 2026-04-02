create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text not null default 'free',
  entitlement_status text not null default 'inactive',
  billing_provider text,
  polar_customer_id text,
  polar_subscription_id text,
  subscription_interval text,
  current_period_end timestamptz,
  last_entitlement_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists billing_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

drop function if exists public.handle_new_user_profile() cascade;

create function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (
    user_id,
    email,
    plan,
    entitlement_status
  )
  values (
    new.id,
    coalesce(new.email, ''),
    'free',
    'inactive'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

drop function if exists public.touch_profile_updated_at() cascade;

create function public.touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_profiles_updated on profiles;

create trigger on_profiles_updated
before update on profiles
for each row
execute function public.touch_profile_updated_at();

alter table profiles enable row level security;
alter table billing_events enable row level security;

drop policy if exists profiles_owner_select on profiles;

create policy profiles_owner_select
on profiles
for select
using (user_id = auth.uid());

create index if not exists idx_profiles_plan_status on profiles (plan, entitlement_status);
create index if not exists idx_profiles_polar_customer_id on profiles (polar_customer_id);
create index if not exists idx_profiles_polar_subscription_id on profiles (polar_subscription_id);
create index if not exists idx_billing_events_provider_event_id on billing_events (provider, event_id);
