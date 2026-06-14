begin;

select plan(3);

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
  '53500000-0000-0000-0000-000000000019',
  'authenticated',
  'authenticated',
  'privacy.535240519@stu.untar.ac.id',
  '',
  now(),
  '{}'::jsonb,
  '{"full_name":"Privacy Student","nim":"535240519"}'::jsonb,
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
    '2d2d0000-0000-0000-0000-000000000019',
    '53500000-0000-0000-0000-000000000019',
    'LOST',
    'Kartu mahasiswa',
    'KTM & Kartu',
    'Kartu mahasiswa ditemukan di sekitar lobi.',
    'Nomor kartu lengkap.',
    'Gedung R',
    now(),
    'PUBLISHED'
  ),
  (
    '2d2d0000-0000-0000-0000-000000000020',
    '53500000-0000-0000-0000-000000000019',
    'FOUND',
    'Tas hitam',
    'Tas',
    'Tas hitam ditemukan di ruang kelas.',
    'Ada gantungan khusus.',
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
    '2d2d0000-0000-0000-0000-000000000019',
    '2d2d0000-0000-0000-0000-000000000019/a8ad0000-0000-0000-0000-000000000019.webp',
    'Foto kartu',
    1
  ),
  (
    '2d2d0000-0000-0000-0000-000000000020',
    '2d2d0000-0000-0000-0000-000000000020/a8ad0000-0000-0000-0000-000000000020.webp',
    'Foto tas',
    1
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
  (select count(*)::integer from public.public_report_images),
  1,
  'public_report_images hides private report images'
);

select is(
  (
    select storage_path like '53500000-0000-0000-0000-000000000019/%'
    from public.public_report_images
    limit 1
  ),
  false,
  'public image paths do not expose reporter UUIDs'
);

select * from finish();
rollback;
