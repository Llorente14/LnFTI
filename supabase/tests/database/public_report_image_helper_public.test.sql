begin;

select plan(1);

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
  '53500000-0000-0000-0000-000000000021',
  'authenticated',
  'authenticated',
  'publichelper.535240521@stu.untar.ac.id',
  '',
  now(),
  '{}'::jsonb,
  '{"full_name":"Publichelper Student","nim":"535240521"}'::jsonb,
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
) values (
  '2d2d0000-0000-0000-0000-000000000021',
  '53500000-0000-0000-0000-000000000021',
  'LOST',
  'Dompet hitam',
  'Dompet',
  'Dompet hitam hilang di sekitar lobi gedung utama.',
  'Ada inisial kecil di bagian dalam.',
  'Gedung R',
  now(),
  'PUBLISHED'
);

insert into public.report_images (
  report_id,
  storage_path,
  alt_text,
  sort_order
) values (
  '2d2d0000-0000-0000-0000-000000000021',
  '2d2d0000-0000-0000-0000-000000000021/a8ad0000-0000-0000-0000-000000000021.webp',
  'Foto dompet',
  1
);

select ok(
  public.is_public_report_image_object(
    '2d2d0000-0000-0000-0000-000000000021/a8ad0000-0000-0000-0000-000000000021.webp'
  ),
  'public image helper accepts published report image'
);

select * from finish();
rollback;
