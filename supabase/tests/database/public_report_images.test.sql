begin;

select plan(11);

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

select is(
  public.is_public_report_image_object('bad/path.webp'),
  false,
  'public image helper rejects malformed path'
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
) values (
  '53500000-0000-0000-0000-000000000017',
  'authenticated',
  'authenticated',
  'publicimage.535240517@stu.untar.ac.id',
  '',
  now(),
  '{}'::jsonb,
  '{"full_name":"Publicimage Student","nim":"535240517"}'::jsonb,
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
  report_status
) values
  (
    '2d2d0000-0000-0000-0000-000000000017',
    '53500000-0000-0000-0000-000000000017',
    'LOST',
    'Dompet hitam',
    'Dompet',
    'Dompet hitam hilang di sekitar lobi gedung utama.',
    'Ada inisial kecil di bagian dalam.',
    'Gedung R',
    now(),
    'PUBLISHED'
  ),
  (
    '2d2d0000-0000-0000-0000-000000000018',
    '53500000-0000-0000-0000-000000000017',
    'FOUND',
    'Botol biru',
    'Botol & Wadah',
    'Botol biru ditemukan di dekat ruang kelas.',
    'Ada stiker kecil.',
    'Gedung M',
    now(),
    'DRAFT'
  );

insert into public.report_images (
  report_id,
  storage_path,
  alt_text,
  sort_order
) values
  (
    '2d2d0000-0000-0000-0000-000000000017',
    '2d2d0000-0000-0000-0000-000000000017/a8ad0000-0000-0000-0000-000000000017.webp',
    'Foto dompet',
    1
  ),
  (
    '2d2d0000-0000-0000-0000-000000000018',
    '2d2d0000-0000-0000-0000-000000000018/a8ad0000-0000-0000-0000-000000000018.webp',
    'Foto botol',
    1
  );

select ok(
  public.is_public_report_image_object(
    '2d2d0000-0000-0000-0000-000000000017/a8ad0000-0000-0000-0000-000000000017.webp'
  ),
  'public image helper accepts published report image'
);

select is(
  public.is_public_report_image_object(
    '2d2d0000-0000-0000-0000-000000000018/a8ad0000-0000-0000-0000-000000000018.webp'
  ),
  false,
  'public image helper returns false for private report image'
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
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and 'anon' = any(roles)
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and (
        coalesce(qual, '') ilike '%report-images%'
        or coalesce(with_check, '') ilike '%report-images%'
      )
  ),
  0,
  'anonymous has no INSERT, UPDATE, or DELETE policy for report-images'
);

select is(
  (select public from storage.buckets where id = 'report-images'),
  false,
  'report-images bucket remains private'
);

select is(
  (select count(*)::integer from public.public_report_images),
  1,
  'public_report_images hides private report images'
);

select is(
  (
    select storage_path like '53500000-0000-0000-0000-000000000017/%'
    from public.public_report_images
    limit 1
  ),
  false,
  'public image paths do not expose reporter UUIDs'
);

select * from finish();
rollback;
