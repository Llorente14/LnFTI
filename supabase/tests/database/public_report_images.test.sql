begin;

select plan(5);

select ok(
  exists (
    select 1
    from information_schema.views
    where table_schema = 'public'
      and table_name = 'public_report_images'
  ),
  'public_report_images view exists'
);

select set_eq(
  $$
    select column_name::text
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_report_images'
  $$,
  $$ values ('report_id'), ('storage_path'), ('alt_text'), ('sort_order') $$,
  'public_report_images exposes only expected columns'
);

select has_function(
  'public',
  'is_public_report_image_object',
  array['text'],
  'public image helper exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_report_images_select_public_reports'
      and cmd = 'SELECT'
      and 'anon' = any(roles)
  ),
  'public Storage SELECT policy exists'
);

select is(
  (select public from storage.buckets where id = 'report-images'),
  false,
  'report-images bucket remains private'
);

select * from finish();
rollback;
