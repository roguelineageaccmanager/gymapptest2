-- Keep the profile edit under the caller's existing owner-only RLS policy.
-- The private Auth metadata trigger performs the narrowly scoped mirror update.
alter function public.change_display_name(text, uuid) security invoker;

-- Cover active foreign keys involved in account cleanup and member lookups.
create index announcements_author_id_idx on public.announcements (author_id);
create index friend_blocks_blocked_id_idx on public.friend_blocks (blocked_id);
create index friend_requests_target_id_idx on public.friend_requests (target_id);
create index progress_comments_user_id_idx on public.progress_comments (user_id);
