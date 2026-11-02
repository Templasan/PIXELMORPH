-- PixelMorph cloud sync, stage 1: the synced project list.
-- Adds one table, public.project_sync, with row level security so each user
-- reads and writes only their own rows. It adds nothing else; presets and
-- community tables come later. Safe to run twice.

create table if not exists public.project_sync (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  name text not null,
  payload jsonb not null,            -- project data and edit history
  files jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, project_id),
  check (octet_length(payload::text) < 10000000)
);

alter table public.project_sync enable row level security;

drop policy if exists "project_sync_select_own" on public.project_sync;
create policy "project_sync_select_own" on public.project_sync
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "project_sync_insert_own" on public.project_sync;
create policy "project_sync_insert_own" on public.project_sync
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "project_sync_update_own" on public.project_sync;
create policy "project_sync_update_own" on public.project_sync
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "project_sync_delete_own" on public.project_sync;
create policy "project_sync_delete_own" on public.project_sync
  for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.project_sync from anon;
grant select, insert, update, delete on public.project_sync to authenticated;
