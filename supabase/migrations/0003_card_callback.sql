-- ============================================================================
-- Growth callback — one line the AI speaks back to the user when a card's skill
-- already exists in their memory ("3rd time you've logged this — a month ago
-- this terrified you"). Computed at capture time and frozen on the card.
-- Run in the SQL editor after 0002_quests.sql.
-- ============================================================================

alter table public.cards add column if not exists callback text;
