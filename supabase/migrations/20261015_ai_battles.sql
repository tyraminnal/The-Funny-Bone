-- Human vs AI caption battles.
-- Run this whole file once in the Supabase SQL Editor (after the other files).
--
-- A student uploads a pic and writes a caption; the AI writes its own caption
-- for the same pic without seeing the student's. Everyone else votes on the
-- funnier one without knowing which is which, then the answer is revealed.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- The two captions are stored as A and B; nothing here says which is the AI.
create table if not exists public.battles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    image_url text not null,
    image_path text not null,
    theme text not null,
    caption_a text not null,
    caption_b text not null,
    votes_a integer not null default 0,
    votes_b integer not null default 0,
    created_at timestamptz not null default now()
);

-- Which side the AI wrote, plus the exact prompt. Nobody can read this table
-- directly; battle_reveals() hands out the answer once you've voted.
create table if not exists public.battle_answers (
    battle_id uuid primary key references public.battles (id) on delete cascade,
    ai_side text not null check (ai_side in ('a', 'b')),
    prompt text not null,      -- the exact prompt sent to the model
    model text not null
);

-- One vote per user per battle, and votes are final.
create table if not exists public.battle_votes (
    battle_id uuid not null references public.battles (id) on delete cascade,
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    side text not null check (side in ('a', 'b')),
    created_at timestamptz not null default now(),
    primary key (battle_id, user_id)
);

create index if not exists battles_created_at_idx on public.battles (created_at desc);
create index if not exists battles_user_id_idx on public.battles (user_id, created_at desc);
create index if not exists battle_votes_user_id_idx on public.battle_votes (user_id);

-- ---------------------------------------------------------------------------
-- Keep battle vote counts in sync, like captions. Runs as definer so voters
-- never need permission to update battles.
-- ---------------------------------------------------------------------------

create or replace function public.apply_battle_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.battles
    set votes_a = votes_a + (case when new.side = 'a' then 1 else 0 end),
        votes_b = votes_b + (case when new.side = 'b' then 1 else 0 end)
    where id = new.battle_id;
    return new;
end;
$$;

drop trigger if exists battle_votes_apply on public.battle_votes;
create trigger battle_votes_apply
after insert on public.battle_votes
for each row execute function public.apply_battle_vote();

revoke execute on function public.apply_battle_vote() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.battles enable row level security;
alter table public.battle_answers enable row level security;
alter table public.battle_votes enable row level security;

-- battles: signed-in users can read. Only the server writes, after the AI responds.
drop policy if exists "battles: signed-in read" on public.battles;
create policy "battles: signed-in read" on public.battles
    for select to authenticated using (true);
revoke insert, update, delete on public.battles from anon, authenticated;

-- battle_answers: server only.
revoke all on public.battle_answers from anon, authenticated;

-- battle_votes: you only see your own votes, vote as yourself, can't vote on
-- your own battle, and can't change or take back a vote.
drop policy if exists "battle votes: read own" on public.battle_votes;
create policy "battle votes: read own" on public.battle_votes
    for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "battle votes: insert own" on public.battle_votes;
create policy "battle votes: insert own" on public.battle_votes
    for insert to authenticated
    with check (
        user_id = (select auth.uid())
        and not exists (
            select 1 from public.battles b
            where b.id = battle_id and b.user_id = (select auth.uid())
        )
    );
revoke update, delete on public.battle_votes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The reveal: which side was the AI, and who the human was. Only for battles
-- you started or already voted on.
-- ---------------------------------------------------------------------------

create or replace function public.battle_reveals(battle_ids uuid[])
returns table (
    battle_id uuid,
    ai_side text,
    human_name text,
    my_side text
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        b.id,
        a.ai_side,
        coalesce(
            nullif(trim(concat_ws(' ', pr.first_name,
                case when coalesce(pr.last_name, '') <> '' then left(pr.last_name, 1) || '.' end)), ''),
            'Anonymous Bone'
        ),
        v.side
    from public.battles b
    join public.battle_answers a on a.battle_id = b.id
    left join public.profiles pr on pr.id = b.user_id
    left join public.battle_votes v on v.battle_id = b.id and v.user_id = (select auth.uid())
    where b.id = any (battle_ids)
      and (select auth.uid()) is not null
      and (b.user_id = (select auth.uid()) or v.user_id is not null);
$$;

revoke execute on function public.battle_reveals(uuid[]) from public, anon;
grant execute on function public.battle_reveals(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Humans vs AI scoreboard. A battle counts once it has at least one vote;
-- whoever has more votes wins it.
-- ---------------------------------------------------------------------------

create or replace function public.battle_scoreboard()
returns table (
    human_wins bigint,
    ai_wins bigint,
    ties bigint,
    my_wins bigint,
    my_losses bigint,
    my_ties bigint
)
language sql
stable
security definer
set search_path = ''
as $$
    with tallies as (
        select
            b.user_id = (select auth.uid()) as mine,
            case a.ai_side when 'a' then b.votes_b else b.votes_a end as human_votes,
            case a.ai_side when 'a' then b.votes_a else b.votes_b end as ai_votes
        from public.battles b
        join public.battle_answers a on a.battle_id = b.id
        where b.votes_a + b.votes_b > 0
    )
    select
        count(*) filter (where human_votes > ai_votes),
        count(*) filter (where ai_votes > human_votes),
        count(*) filter (where human_votes = ai_votes),
        count(*) filter (where mine and human_votes > ai_votes),
        count(*) filter (where mine and ai_votes > human_votes),
        count(*) filter (where mine and human_votes = ai_votes)
    from tallies
    where (select auth.uid()) is not null;
$$;

revoke execute on function public.battle_scoreboard() from public, anon;
grant execute on function public.battle_scoreboard() to authenticated;

-- ---------------------------------------------------------------------------
-- Points ranking, now counting battles too:
--
--   +2 for each pic you post or battle you start
--   +1 for each vote you cast on someone else's caption or battle
--   +1 for each LOL (-1 for each meh) other people give your captions
--   +1 for each battle vote your caption beats the AI for
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
    with others_votes as (
        select v.user_id as voter, c.user_id as author, v.vote
        from public.caption_votes v
        join public.captions c on c.id = v.caption_id
        where v.user_id <> c.user_id
    ),
    others_battle_votes as (
        select v.user_id as voter, b.user_id as author, v.side <> a.ai_side as for_human
        from public.battle_votes v
        join public.battles b on b.id = v.battle_id
        join public.battle_answers a on a.battle_id = b.id
        where v.user_id <> b.user_id
    ),
    points as (
        select g.user_id, count(*) * 2 as pts from public.generations g group by g.user_id
        union all
        select voter, count(*) from others_votes group by voter
        union all
        select author, sum(vote) from others_votes group by author
        union all
        select b.user_id, count(*) * 2 from public.battles b group by b.user_id
        union all
        select voter, count(*) from others_battle_votes group by voter
        union all
        select author, count(*) from others_battle_votes where for_human group by author
    ),
    totals as (
        select p.user_id, sum(p.pts)::bigint as points from points p group by p.user_id
    ),
    ranked as (
        select
            rank() over (order by t.points desc) as rank,
            pr.id as user_id,
            coalesce(
                nullif(trim(concat_ws(' ', pr.first_name,
                    case when coalesce(pr.last_name, '') <> '' then left(pr.last_name, 1) || '.' end)), ''),
                'Anonymous Bone'
            ) as display_name,
            pr.avatar_url,
            t.points,
            pr.id = (select auth.uid()) as is_me
        from public.profiles pr
        join totals t on t.user_id = pr.id
    )
    select * from ranked
    where (select auth.uid()) is not null
      and (rank <= least(greatest(max_rows, 1), 50) or is_me)
    order by rank, display_name;
$$;

revoke execute on function public.leaderboard(integer) from public, anon;
grant execute on function public.leaderboard(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Live updates: the ranking and battle pages refresh when battles change.
-- ---------------------------------------------------------------------------

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'battles'
    ) then
        alter publication supabase_realtime add table public.battles;
    end if;
end;
$$;
