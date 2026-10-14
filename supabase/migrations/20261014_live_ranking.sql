-- Live points ranking: broadcast new posts and vote-total changes over
-- Supabase Realtime so open pages refresh the ranking on their own.
-- Run this whole file once in the Supabase SQL Editor (after the other two).
--
-- Realtime still applies row level security, so signed-in users only hear
-- about rows they could already read. caption_votes stays private; the
-- vote trigger updates captions, and that update is what gets broadcast.

do $$
declare
    t text;
begin
    foreach t in array array['generations', 'captions'] loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
        ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end;
$$;
