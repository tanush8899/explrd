-- ============================================================================
-- explrd — usernames + friend requests
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- Case-insensitive text, so "Tanush" and "tanush" can't both be taken.
create extension if not exists citext;

-- ── profiles: identity columns ─────────────────────────────────────────────
alter table public.profiles add column if not exists username   citext;
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name  text;

-- One handle per person, enforced case-insensitively (NULLs allowed → pre-onboarding).
create unique index if not exists profiles_username_key on public.profiles (username);

-- Everyone is public by default now (no per-user toggle).
alter table public.profiles alter column is_public set default true;
update public.profiles set is_public = true where is_public is distinct from true;

-- Backfill: adopt the old public_slug as the username where it's free and valid.
-- Collisions / invalid slugs stay NULL and are forced through onboarding.
update public.profiles p
set username = lower(p.public_slug)
where p.username is null
  and p.public_slug is not null
  and p.public_slug ~ '^[a-z][a-z0-9_.]{2,19}$'
  and not exists (
    select 1 from public.profiles q
    where q.user_id <> p.user_id
      and lower(q.public_slug) = lower(p.public_slug)
  );

-- ── friend_requests: models pending requests AND accepted friendships ───────
-- A friendship is any row with status='accepted' (direction-agnostic).
create table if not exists public.friend_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users(id) on delete cascade,
  addressee_id  uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending'
                 check (status in ('pending', 'accepted', 'rejected')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists friend_requests_addressee_idx
  on public.friend_requests (addressee_id, status);
create index if not exists friend_requests_requester_idx
  on public.friend_requests (requester_id, status);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- The API routes use the service-role key (which bypasses RLS), so the app does
-- NOT depend on these policies — they're defense-in-depth for any anon/auth
-- client that ever queries the table directly.
alter table public.friend_requests enable row level security;

drop policy if exists "friend_requests_select_own" on public.friend_requests;
create policy "friend_requests_select_own" on public.friend_requests
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friend_requests_insert_own" on public.friend_requests;
create policy "friend_requests_insert_own" on public.friend_requests
  for insert with check (auth.uid() = requester_id);

drop policy if exists "friend_requests_update_party" on public.friend_requests;
create policy "friend_requests_update_party" on public.friend_requests
  for update using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friend_requests_delete_party" on public.friend_requests;
create policy "friend_requests_delete_party" on public.friend_requests
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);
