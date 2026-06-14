begin;

select plan(12);

select has_type('public', 'application_role', 'application_role enum exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'reports', 'reports table exists');
select has_table('public', 'report_images', 'report_images table exists');
select has_table('public', 'claims', 'claims table exists');
select has_table('public', 'handovers', 'handovers table exists');
select has_table('public', 'audit_logs', 'audit_logs table exists');
select has_table('public', 'export_jobs', 'export_jobs table exists');

select set_eq(
  $$
    select relname::text
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where nspname = 'public'
      and relname in ('profiles', 'reports', 'report_images', 'claims', 'handovers', 'audit_logs', 'export_jobs')
      and relrowsecurity
  $$,
  $$ values ('profiles'), ('reports'), ('report_images'), ('claims'), ('handovers'), ('audit_logs'), ('export_jobs') $$,
  'RLS is enabled on every application table'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'reports', 'report_images', 'claims', 'handovers', 'audit_logs', 'export_jobs')
  ),
  15,
  'the complete role policy set is installed'
);

select has_view('public', 'public_reports', 'safe public report view exists');
select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_reports'
      and column_name in ('reporter_id', 'private_characteristics', 'location_detail', 'reviewed_by', 'rejection_reason')
  ),
  0,
  'public report view excludes private and workflow columns'
);

select * from finish();
rollback;
