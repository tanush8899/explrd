-- ============================================================================
-- explrd — store the Google/OAuth profile picture so friends can see it too
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.profiles add column if not exists avatar_url text;

-- Backfill from the auth user metadata Google populates on sign-in
-- (avatar_url, falling back to picture). New sign-ins keep it fresh via the
-- /api/profile route, but this seeds existing accounts immediately.
update public.profiles p
set avatar_url = coalesce(
  u.raw_user_meta_data ->> 'avatar_url',
  u.raw_user_meta_data ->> 'picture'
)
from auth.users u
where u.id = p.user_id
  and p.avatar_url is null
  and coalesce(
        u.raw_user_meta_data ->> 'avatar_url',
        u.raw_user_meta_data ->> 'picture'
      ) is not null;
