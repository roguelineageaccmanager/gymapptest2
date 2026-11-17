-- Optional rank calculation snapshot. Existing friend-only RLS, block policies,
-- owner-only writes and score-sharing deletion/guard triggers remain authoritative.
alter table public.leaderboard_stats
  add column if not exists rank_details jsonb;
alter table public.leaderboard_stats
  add constraint leaderboard_rank_details_bounded check (
    rank_details is null or coalesce((
      jsonb_typeof(rank_details) = 'object'
      and octet_length(rank_details::text) <= 1048576
      and rank_details->>'version' = '1'
      and jsonb_typeof(rank_details->'exercises') = 'array'
      and jsonb_array_length(rank_details->'exercises') <= 2000
    ),false)
  );
notify pgrst, 'reload schema';
