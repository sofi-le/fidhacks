-- ============================================================================
-- Quests — the "Quest Journey" goals, moved out of browser localStorage into a
-- per-user table (mirrors public.cards). RLS scopes every row to its owner.
-- Run this in the SQL editor after 0001_init.sql.
--
-- Dates are stored as TEXT ("YYYY-MM-DD" or "") to match how the UI already
-- handles them (deadlines can be blank), so there's no timezone juggling.
-- ============================================================================

create table if not exists public.quests (
  id             text primary key default (gen_random_uuid())::text,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type           text not null,
  skill          text not null,
  aim            text not null default '',
  quest_date     text,                 -- when it was added (the UI's `date`)
  deadline       text,                 -- target date, or '' for none
  status         text not null default 'not_started',  -- not_started | in_progress | completed
  completed_date text,
  win            text,
  created_at     timestamptz not null default now()
);

create index if not exists quests_user on public.quests (user_id, quest_date, created_at);

alter table public.quests enable row level security;

drop policy if exists "own quests" on public.quests;
create policy "own quests" on public.quests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
