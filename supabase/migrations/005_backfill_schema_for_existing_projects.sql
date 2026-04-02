-- Backfill older deployed projects to the current Canopy schema without
-- requiring historical migration drift to be edited in place.

create table if not exists folders (
  id uuid primary key,
  user_id uuid references auth.users not null,
  name text not null,
  parent_id uuid references folders(id) on delete cascade,
  color text,
  pinned boolean default false,
  "order" integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tags (
  id uuid primary key,
  user_id uuid references auth.users not null,
  name text not null,
  color text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists note_tags (
  note_id uuid references notes(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (note_id, tag_id)
);

alter table notes add column if not exists folder_id uuid references folders(id) on delete set null;
alter table notes add column if not exists pinned boolean default false;
alter table notes add column if not exists updated_at timestamptz default now();
alter table notes alter column updated_at set default now();

update notes
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table notes alter column updated_at set not null;

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

create or replace function public.handle_new_user_profile()
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

create or replace function public.touch_profile_updated_at()
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

insert into profiles (
  user_id,
  email,
  plan,
  entitlement_status
)
select
  users.id,
  coalesce(users.email, ''),
  'free',
  'inactive'
from auth.users as users
on conflict (user_id) do nothing;

create or replace function public.has_active_pro_entitlement(target_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from profiles
    where profiles.user_id = target_user_id
      and profiles.plan = 'pro'
      and profiles.entitlement_status = 'active'
  );
$$;

alter table notes enable row level security;
alter table folders enable row level security;
alter table tags enable row level security;
alter table note_tags enable row level security;
alter table profiles enable row level security;
alter table billing_events enable row level security;

drop policy if exists "Users own notes" on notes;
drop policy if exists notes_user_select on notes;
drop policy if exists notes_user_insert on notes;
drop policy if exists notes_user_update on notes;
drop policy if exists notes_user_delete on notes;

create policy notes_user_select
on notes
for select
using (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
);

create policy notes_user_insert
on notes
for insert
with check (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
);

create policy notes_user_update
on notes
for update
using (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
)
with check (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
);

create policy notes_user_delete
on notes
for delete
using (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
);

drop policy if exists folders_user_select on folders;
drop policy if exists folders_user_insert on folders;
drop policy if exists folders_user_update on folders;
drop policy if exists folders_user_delete on folders;

create policy folders_user_select
on folders
for select
using (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
);

create policy folders_user_insert
on folders
for insert
with check (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
  and (
    parent_id is null
    or parent_id in (
      select id
      from folders
      where user_id = auth.uid()
    )
  )
);

create policy folders_user_update
on folders
for update
using (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
)
with check (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
  and (
    parent_id is null
    or parent_id in (
      select id
      from folders
      where user_id = auth.uid()
    )
  )
);

create policy folders_user_delete
on folders
for delete
using (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
);

drop policy if exists tags_user_policy on tags;
drop policy if exists tags_user_select on tags;
drop policy if exists tags_user_insert on tags;
drop policy if exists tags_user_update on tags;
drop policy if exists tags_user_delete on tags;

create policy tags_user_select
on tags
for select
using (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
);

create policy tags_user_insert
on tags
for insert
with check (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
);

create policy tags_user_update
on tags
for update
using (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
)
with check (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
);

create policy tags_user_delete
on tags
for delete
using (
  user_id = auth.uid()
  and public.has_active_pro_entitlement(auth.uid())
);

drop policy if exists note_tags_user_policy on note_tags;
drop policy if exists note_tags_user_select on note_tags;
drop policy if exists note_tags_user_insert on note_tags;
drop policy if exists note_tags_user_delete on note_tags;

create policy note_tags_user_select
on note_tags
for select
using (
  public.has_active_pro_entitlement(auth.uid())
  and exists (
    select 1
    from notes
    where notes.id = note_tags.note_id
      and notes.user_id = auth.uid()
  )
  and exists (
    select 1
    from tags
    where tags.id = note_tags.tag_id
      and tags.user_id = auth.uid()
  )
);

create policy note_tags_user_insert
on note_tags
for insert
with check (
  public.has_active_pro_entitlement(auth.uid())
  and exists (
    select 1
    from notes
    where notes.id = note_tags.note_id
      and notes.user_id = auth.uid()
  )
  and exists (
    select 1
    from tags
    where tags.id = note_tags.tag_id
      and tags.user_id = auth.uid()
  )
);

create policy note_tags_user_delete
on note_tags
for delete
using (
  public.has_active_pro_entitlement(auth.uid())
  and exists (
    select 1
    from notes
    where notes.id = note_tags.note_id
      and notes.user_id = auth.uid()
  )
  and exists (
    select 1
    from tags
    where tags.id = note_tags.tag_id
      and tags.user_id = auth.uid()
  )
);

drop policy if exists profiles_owner_select on profiles;

create policy profiles_owner_select
on profiles
for select
using (user_id = auth.uid());

create unique index if not exists idx_tags_user_name on tags(user_id, lower(name));
create index if not exists idx_folders_user_id on folders(user_id);
create index if not exists idx_folders_parent_id on folders(parent_id);
create index if not exists idx_tags_user_id on tags(user_id);
create index if not exists idx_notes_folder_id on notes(folder_id);
create index if not exists idx_note_tags_note_id on note_tags(note_id);
create index if not exists idx_note_tags_tag_id on note_tags(tag_id);
create index if not exists idx_profiles_plan_status on profiles (plan, entitlement_status);
create index if not exists idx_profiles_polar_customer_id on profiles (polar_customer_id);
create index if not exists idx_profiles_polar_subscription_id on profiles (polar_subscription_id);
create index if not exists idx_billing_events_provider_event_id on billing_events (provider, event_id);
create index if not exists idx_notes_user_updated_at on notes (user_id, updated_at desc);
