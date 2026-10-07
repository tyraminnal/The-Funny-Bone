-- Assignment 4, part 2: user-chosen caption voices, open voting, points
-- ranking, and the AI meme shown to logged-out visitors.
-- Run this whole file once in the Supabase SQL Editor (after the first file).

-- The voice the uploader asked for ("my mom on Facebook", "a tired TA"...).
alter table public.generations add column if not exists voice text;

-- ---------------------------------------------------------------------------
-- Votes: any signed-in user can vote on any caption, including their own.
-- Votes are never edited. Changing a vote deletes the old row and inserts a
-- new one, so every vote a user submits is a new row.
-- ---------------------------------------------------------------------------

drop policy if exists "votes: insert own" on public.caption_votes;
create policy "votes: insert own" on public.caption_votes
    for insert to authenticated
    with check (user_id = (select auth.uid()));

drop policy if exists "votes: update own" on public.caption_votes;
revoke update on public.caption_votes from authenticated;

-- ---------------------------------------------------------------------------
-- AI memes for the logged-out home page. Only the server reads and writes
-- this table, so RLS is on with no policies at all.
-- ---------------------------------------------------------------------------

create table if not exists public.showcase_memes (
    id uuid primary key default gen_random_uuid(),
    template_name text not null,
    image_url text not null,
    top_text text not null default '',
    bottom_text text not null,
    theme text not null,
    prompt text not null,      -- the exact prompt sent to the model
    model text not null,
    created_at timestamptz not null default now()
);

create index if not exists showcase_memes_created_at_idx on public.showcase_memes (created_at desc);

alter table public.showcase_memes enable row level security;
revoke all on public.showcase_memes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Points ranking. Profiles stay private (owner-only RLS), so this definer
-- function hands signed-in users only a display name, avatar, and points.
--
--   +2 for each pic you post
--   +1 for each vote you cast on someone else's caption
--   +1 for each LOL (-1 for each meh) other people give your captions
-- ---------------------------------------------------------------------------

create or replace function public.leaderboard(max_rows integer default 10)
returns table (
    rank bigint,
    user_id uuid,
    display_name text,
    avatar_url text,
    points bigint,
    is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
    with posted as (
        select g.user_id, count(*) * 2 as pts
        from public.generations g
        group by g.user_id
    ),
    others_votes as (
        select v.user_id as voter, c.user_id as author, v.vote
        from public.caption_votes v
        join public.captions c on c.id = v.caption_id
        where v.user_id <> c.user_id
    ),
    cast_votes as (
        select voter as user_id, count(*) as pts from others_votes group by voter
    ),
    earned as (
        select author as user_id, sum(vote) as pts from others_votes group by author
    ),
    ranked as (
        select
            rank() over (order by coalesce(p.pts, 0) + coalesce(cv.pts, 0) + coalesce(e.pts, 0) desc) as rank,
            pr.id as user_id,
            coalesce(
                nullif(trim(concat_ws(' ', pr.first_name,
                    case when coalesce(pr.last_name, '') <> '' then left(pr.last_name, 1) || '.' end)), ''),
                'Anonymous Bone'
            ) as display_name,
            pr.avatar_url,
            (coalesce(p.pts, 0) + coalesce(cv.pts, 0) + coalesce(e.pts, 0))::bigint as points,
            pr.id = (select auth.uid()) as is_me
        from public.profiles pr
        left join posted p on p.user_id = pr.id
        left join cast_votes cv on cv.user_id = pr.id
        left join earned e on e.user_id = pr.id
        where p.user_id is not null or cv.user_id is not null or e.user_id is not null
    )
    select * from ranked
    where (select auth.uid()) is not null
      and (rank <= least(greatest(max_rows, 1), 50) or is_me)
    order by rank, display_name;
$$;

revoke execute on function public.leaderboard(integer) from public, anon;
grant execute on function public.leaderboard(integer) to authenticated;
