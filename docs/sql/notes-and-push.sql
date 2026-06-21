-- ============================================================================
-- explrd — per-city notes + push notification tokens
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- ── City notes ──────────────────────────────────────────────────────────────
-- Notes are per-user (live on the user_places pin, not the shared places_cache),
-- so two people who both saved "Tokyo" keep separate notes. Length is enforced
-- in the app (500 chars); the column is plain text.
alter table public.user_places add column if not exists notes text;

-- ── Push notification tokens ─────────────────────────────────────────────────
-- One row per device token. A user may have several (phone + tablet, reinstalls).
-- token is the Expo push token ("ExponentPushToken[...]"). On reinstall Expo can
-- reissue a token to a different user, so we upsert on the token and overwrite
-- user_id to keep ownership current.
create table if not exists public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- The API routes use the service-role key (bypasses RLS); these policies are
-- defense-in-depth for any client that ever queries the table directly.
drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own" on public.push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "push_tokens_insert_own" on public.push_tokens;
create policy "push_tokens_insert_own" on public.push_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_tokens_update_own" on public.push_tokens;
create policy "push_tokens_update_own" on public.push_tokens
  for update using (auth.uid() = user_id);

drop policy if exists "push_tokens_delete_own" on public.push_tokens;
create policy "push_tokens_delete_own" on public.push_tokens
  for delete using (auth.uid() = user_id);
