begin;

select plan(10);

select ok(
  exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ),
  'supabase_realtime publication exists'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reports'
  ),
  'public.reports is published'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'claims'
  ),
  'public.claims is published'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'handovers'
  ),
  'public.handovers is published'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'audit_logs'
  ),
  'public.audit_logs is not published'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ),
  'public.profiles is not published'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'report_images'
  ),
  'public.report_images is not published'
);

select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.reports'::regclass),
  true,
  'RLS remains enabled on reports'
);

select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.claims'::regclass),
  true,
  'RLS remains enabled on claims'
);

select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.handovers'::regclass),
  true,
  'RLS remains enabled on handovers'
);

select * from finish();
rollback;
