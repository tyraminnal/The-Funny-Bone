-- Assignment 4: AI captions, voting, and row level security.
-- Run this whole file once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per photo a user uploads and sends to the model.
create table if not exists public.generations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    image_url text not null,
    image_path text not null,
    theme text not null,
    user_context text,
    prompt text not null,      -- the exact prompt sent to the model
    model text not null,
    created_at timestamptz not null default now()
);

-- AI generated captions for a generation. Vote counts are maintained by trigger.
create table if not exists public.captions (
    id uuid primary key default gen_random_uuid(),
    generation_id uuid not null references public.generations (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    style text not null,
    text text not null,
    upvotes integer not null default 0,
    downvotes integer not null default 0,
    score integer not null default 0,
    created_at timestamptz not null default now()
);

-- One vote per user per caption. A new row is inserted on a user's first vote.
create table if not exists public.caption_votes (
    id bigint generated always as identity primary key,
    caption_id uuid not null references public.captions (id) on delete cascade,
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    vote smallint not null check (vote in (-1, 1)),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (caption_id, user_id)
);

create index if not exists generations_created_at_idx on public.generations (created_at desc);
create index if not exists generations_user_id_idx on public.generations (user_id, created_at desc);
create index if not exists captions_generation_id_idx on public.captions (generation_id);
create index if not exists captions_created_at_score_idx on public.captions (created_at, score desc);

-- ---------------------------------------------------------------------------
-- Keep caption vote counts in sync. Runs as definer so voters never need
-- (and never get) permission to update captions directly.
-- ---------------------------------------------------------------------------

create or replace function public.apply_caption_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    old_vote smallint := case when tg_op in ('UPDATE', 'DELETE') then old.vote else 0 end;
    new_vote smallint := case when tg_op in ('INSERT', 'UPDATE') then new.vote else 0 end;
    target uuid := case when tg_op = 'DELETE' then old.caption_id else new.caption_id end;
begin
    update public.captions
    set upvotes   = upvotes   + (case when new_vote = 1 then 1 else 0 end) - (case when old_vote = 1 then 1 else 0 end),
        downvotes = downvotes + (case when new_vote = -1 then 1 else 0 end) - (case when old_vote = -1 then 1 else 0 end),
        score     = score + new_vote - old_vote
    where id = target;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

drop trigger if exists caption_votes_apply on public.caption_votes;
create trigger caption_votes_apply
after insert or update of vote or delete on public.caption_votes
for each row execute function public.apply_caption_vote();

create or replace function public.touch_caption_vote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    -- A vote can't be moved to another caption or user.
    new.caption_id := old.caption_id;
    new.user_id := old.user_id;
    return new;
end;
$$;

drop trigger if exists caption_votes_touch on public.caption_votes;
create trigger caption_votes_touch
before update on public.caption_votes
for each row execute function public.touch_caption_vote();

revoke execute on function public.apply_caption_vote() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: on for every table in public, strictest rules that
-- still let the app work. Existing policies on these tables are replaced.
-- ---------------------------------------------------------------------------

do $$
declare
    t record;
    p record;
begin
    for t in select tablename from pg_tables where schemaname = 'public' loop
        execute format('alter table public.%I enable row level security', t.tablename);
    end loop;

    for p in
        select tablename, policyname from pg_policies
        where schemaname = 'public'
          and tablename in ('profiles', 'tvshows', 'generations', 'captions', 'caption_votes')
    loop
        execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    end loop;
end;
$$;

-- profiles: you can only see and edit your own row.
do $$
begin
    if to_regclass('public.profiles') is not null then
        create policy "profiles: read own" on public.profiles
            for select to authenticated using (id = (select auth.uid()));
        create policy "profiles: insert own" on public.profiles
            for insert to authenticated with check (id = (select auth.uid()));
        create policy "profiles: update own" on public.profiles
            for update to authenticated
            using (id = (select auth.uid())) with check (id = (select auth.uid()));
    end if;
end;
$$;

-- tvshows: read-only, signed-in users only.
do $$
begin
    if to_regclass('public.tvshows') is not null then
        create policy "tvshows: signed-in read" on public.tvshows
            for select to authenticated using (true);
    end if;
end;
$$;

-- generations and captions: signed-in users can read. Only the server
-- (service role, after the model responds) can write, so nobody can post
-- hand-written "AI" captions or fake vote counts through the API.
create policy "generations: signed-in read" on public.generations
    for select to authenticated using (true);

create policy "captions: signed-in read" on public.captions
    for select to authenticated using (true);

-- caption_votes: you only see your own votes, can only vote as yourself,
-- and can't vote on captions from your own uploads.
create policy "votes: read own" on public.caption_votes
    for select to authenticated using (user_id = (select auth.uid()));

create policy "votes: insert own" on public.caption_votes
    for insert to authenticated
    with check (
        user_id = (select auth.uid())
        and not exists (
            select 1 from public.captions c
            where c.id = caption_id and c.user_id = (select auth.uid())
        )
    );

create policy "votes: update own" on public.caption_votes
    for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy "votes: delete own" on public.caption_votes
    for delete to authenticated using (user_id = (select auth.uid()));

-- Logged-out visitors get nothing from the new tables.
revoke all on public.generations, public.captions, public.caption_votes from anon;
grant select on public.generations, public.captions to authenticated;
grant select, insert, update, delete on public.caption_votes to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public bucket for uploaded photos. Uploads go through the server
-- with the service role, so no insert policy is granted to users.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memes', 'memes', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
