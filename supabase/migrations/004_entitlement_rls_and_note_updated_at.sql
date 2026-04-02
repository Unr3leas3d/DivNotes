alter table notes add column if not exists updated_at timestamptz;
alter table notes alter column updated_at set default now();

update notes
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table notes alter column updated_at set not null;

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

create index if not exists idx_notes_user_updated_at on notes (user_id, updated_at desc);
