-- ============================================================================
-- JourneyDex — Supabase schema (run once in the SQL editor of your project).
--
--   profiles  = one row per signed-in user (name + avatar from signup metadata)
--   cards     = each user's wins (was the local SQLite `cards` table)
--   card-art  = Storage bucket holding card images (seed art + uploads)
--
-- Row-Level Security scopes every read/write to the logged-in user, so the
-- browser can talk to Supabase directly with the public anon key — no server.
-- Skills ("semantic memory") are derived from cards on the fly, so there is
-- no separate skills table anymore.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- cards  (id is TEXT so the seed cards can keep their 'c1'..'c14' ids and new
--         cards get a generated uuid string)
-- ---------------------------------------------------------------------------
create table if not exists public.cards (
  id         text primary key default (gen_random_uuid())::text,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  timestamp  timestamptz not null default now(),
  type       text not null,
  win        text not null,
  skill      text not null,
  image_url  text,
  created_at timestamptz not null default now()
);
create index if not exists cards_user_ts on public.cards (user_id, timestamp desc);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.cards    enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own cards" on public.cards;
create policy "own cards" on public.cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a user signs up (pulls name + avatar from the
-- signup metadata Supabase stores in raw_user_meta_data, e.g. full_name).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage bucket for card art (public read; users write only inside their own
-- "{user_id}/" folder). Seed images live under "seed/" and are uploaded once
-- by the service-role script (which bypasses these policies).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('card-art', 'card-art', true)
on conflict (id) do nothing;

drop policy if exists "card-art public read"  on storage.objects;
drop policy if exists "card-art owner write"  on storage.objects;
drop policy if exists "card-art owner update" on storage.objects;
drop policy if exists "card-art owner delete" on storage.objects;

create policy "card-art public read" on storage.objects
  for select using (bucket_id = 'card-art');

create policy "card-art owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'card-art' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "card-art owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'card-art' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "card-art owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'card-art' and (storage.foldername(name))[1] = auth.uid()::text);
