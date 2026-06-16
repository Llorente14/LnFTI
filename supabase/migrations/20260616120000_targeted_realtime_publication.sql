-- LNFTI-22 targeted Realtime Postgres Changes publication.
-- Only workflow status tables are added. RLS and table grants remain unchanged.

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'reports'
    ) then
      alter publication supabase_realtime add table public.reports;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'claims'
    ) then
      alter publication supabase_realtime add table public.claims;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'handovers'
    ) then
      alter publication supabase_realtime add table public.handovers;
    end if;
  end if;
end;
$$;
