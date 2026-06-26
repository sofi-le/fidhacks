-- ============================================================================
-- Favorite flag — whether the user has starred a card. Stored on the row so it
-- is per-user (scoped by the existing "own cards" RLS policy), survives sign-out
-- / sign-in and other devices, and can never drift out of sync with the card
-- list the way the old localStorage list did. Deleting a card drops its favorite
-- automatically (the row is gone).
-- Run in the SQL editor after 0003_card_callback.sql.
-- ============================================================================

alter table public.cards add column if not exists favorite boolean not null default false;
