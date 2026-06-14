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
    '2d2d0000-0000-0000-000000000018',
    '2d2d0000-0000-0000-0000-000000000018/a8ad0000-0000-0000-0000-000000000018.webp',
    'Foto botol',
    1
  );

select is(
  public.is_public_report_image_object('bad/path.webp'),
  false,
  'public image helper rejects malformed path'
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

select * from finish();
rollback;
