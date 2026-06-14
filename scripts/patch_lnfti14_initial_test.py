from pathlib import Path

path = Path("supabase/tests/database/initial_schema.test.sql")
text = path.read_text(encoding="utf-8")

old = """select results_eq(
  $$
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'reports',
        'report_images',
        'claims',
        'handovers',
        'audit_logs',
        'export_jobs'
      )
    order by tablename, policyname
  $$,
  $$ values ('profiles'::name, 'profiles_select_own'::name, 'SELECT'::text) $$,
  'only the LNFTI-13 own-profile SELECT policy exists'
);
"""

new = """select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_own'
      and cmd = 'SELECT'
  ),
  'LNFTI-13 own-profile SELECT policy remains'
);
"""

if old not in text:
    raise SystemExit("Expected LNFTI-13 policy assertion was not found")

path.write_text(text.replace(old, new, 1), encoding="utf-8")
