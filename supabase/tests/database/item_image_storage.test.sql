begin;

select plan(14);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'report-images'
      and name = 'report-images'
  ),
  'report-images bucket exists'
);

select is(
  (select public from storage.buckets where id = 'report-images'),
  false,
  'report-images bucket is private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'report-images'),
  5242880::bigint,
  'report-images bucket file size limit is 5 MiB'
);

select set_eq(
  $$
    select unnest(allowed_mime_types)::text
    from storage.buckets
    where id = 'report-images'
  $$,
  $$ values ('image/jpeg'), ('image/png'), ('image/webp') $$,
  'report-images bucket allows exactly JPEG, PNG, and WebP'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_report_images_insert_verified_owner_editable'
      and cmd = 'INSERT'
      and 'authenticated' = any(roles)
  ),
  'expected INSERT policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_report_images_select_owner_verifier_admin'
      and cmd = 'SELECT'
      and 'authenticated' = any(roles)
  ),
  'expected SELECT policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_report_images_delete_owner_editable'
      and cmd = 'DELETE'
      and 'authenticated' = any(roles)
  ),
  'expected DELETE policy exists'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd = 'UPDATE'
      and policyname like 'storage_report_images_%'
  ),
  'no UPDATE policy exists for report-images'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        'anon' = any(roles)
        or 'public' = any(roles)
      )
      and (
        coalesce(qual, '') ilike '%report-images%'
        or coalesce(with_check, '') ilike '%report-images%'
      )
  ),
  'anonymous has no direct object policy for report-images'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_report_images_select_owner_verifier_admin'
      and qual like '%verifier%'
      and qual like '%admin%'
  ),
  'verifier and admin read rule is represented by the SELECT policy'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '53500000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'owner.535240501@stu.untar.ac.id',
    '',
    now(),
    '{}'::jsonb,
    '{"full_name":"Owner Student","nim":"535240501"}'::jsonb,
    now(),
    now()
  ),
  (
    '82500000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'other.825250502@stu.untar.ac.id',
    '',
    now(),
    '{}'::jsonb,
    '{"full_name":"Other Student","nim":"825250502"}'::jsonb,
    now(),
    now()
  );

insert into public.reports (
  id,
  reporter_id,
  report_type,
  item_name,
  category,
  public_description,
  private_characteristics,
  building,
  event_at,
  report_status,
  custody_status,
  published_at
) values
  (
    '2d2d0000-0000-0000-0000-000000000002',
    '53500000-0000-0000-0000-000000000001',
    'LOST',
    'Black wallet',
    'Wallet',
    'Black wallet lost near the lobby',
    'Private initials inside',
    'Gedung R',
    now(),
    'DRAFT',
    'UNKNOWN',
    null
  ),
  (
    '2d2d0000-0000-0000-0000-000000000003',
    '53500000-0000-0000-0000-000000000001',
    'FOUND',
    'Blue umbrella',
    'Personal item',
    'Blue umbrella found near classroom',
    'Sticker under the handle',
    'Gedung M',
    now(),
    'PUBLISHED',
    'AT_DPM',
    now()
  ),
  (
    '2d2d0000-0000-0000-0000-000000000004',
    '82500000-0000-0000-0000-000000000002',
    'LOST',
    'Silver charger',
    'Electronics',
    'Silver charger lost in the library',
    'Private label on cable',
    'Gedung M',
    now(),
    'DRAFT',
    'UNKNOWN',
    null
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '53500000-0000-0000-0000-000000000001', true);

select ok(
  public.is_report_image_object_path_allowed(
    '53500000-0000-0000-0000-000000000001/2d2d0000-0000-0000-0000-000000000002/a8ad0000-0000-0000-0000-000000000003.webp',
    true
  ),
  'valid owner draft path helper returns true'
);

select is(
  public.is_report_image_object_path_allowed(
    '82500000-0000-0000-0000-000000000002/2d2d0000-0000-0000-0000-000000000004/a8ad0000-0000-0000-0000-000000000003.webp',
    true
  ),
  false,
  'another user path returns false'
);

select is(
  public.is_report_image_object_path_allowed('bad/path.webp', true),
  false,
  'malformed path returns false'
);

select is(
  public.is_report_image_object_path_allowed(
    '53500000-0000-0000-0000-000000000001/2d2d0000-0000-0000-0000-000000000003/a8ad0000-0000-0000-0000-000000000003.webp',
    true
  ),
  false,
  'published report deletion check returns false'
);

reset role;

select * from finish();

rollback;
