-- The owner requested latest-weight sharing for this friends-only app.
-- Existing friend_summaries() still checks accepted friendships; raw histories
-- remain owner-only. Retain the flag for compatibility with installed versions.
alter table public.profiles alter column share_weight set default true;
update public.profiles set share_weight = true where not share_weight;
