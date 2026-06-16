begin;

select plan(7);

select ok(
  public.is_verified_profile_status('verified'),
  'lowercase production verified status is accepted'
);

select ok(
  public.is_verified_profile_status('VERIFIED'),
  'legacy uppercase verified status is accepted'
);

select is(
  public.is_verified_profile_status(' pending '),
  false,
  'non-verified status is rejected after normalization'
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
)
values
  (
    '00000000-0000-0000-0000-000000000381',
    'authenticated',
    'authenticated',
    'studentrlsone.535240381@stu.untar.ac.id',
    '',
    now(),
    '{}'::jsonb,
    '{"full_name":"Studentrlsone Access","nim":"535240381"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000382',
    'authenticated',
    'authenticated',
    'studentrlstwo.535240382@stu.untar.ac.id',
    '',
    now(),
    '{}'::jsonb,
    '{"full_name":"Studentrlstwo Access","nim":"535240382"}'::jsonb,
    now(),
    now()
  );

update public.profiles
set
  verification_status = 'VERIFIED'::public.profile_verification_status,
  verified_at = now()
where id = '00000000-0000-0000-0000-000000000381';

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000381';
set local role authenticated;

select ok(public.is_verified_student(), 'verified student passes the RLS helper');

select lives_ok(
  $$
    insert into public.reports (
      id,
      reporter_id,
      report_type,
      item_name,
      category,
      public_description,
      building,
      event_at,
      report_status
    ) values (
      '10000000-0000-0000-0000-000000000381',
      '00000000-0000-0000-0000-000000000381',
      'LOST',
      'Wireless mouse',
      'Elektronik',
      'Mouse nirkabel hitam hilang di ruang kelas lantai tiga.',
      'Gedung R',
      now(),
      'DRAFT'
    )
  $$,
  'verified student can insert a draft report through RLS'
);

reset role;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000382';
set local role authenticated;

select is(public.is_verified_student(), false, 'unverified student fails the RLS helper');

select throws_ok(
  $$
    insert into public.reports (
      id,
      reporter_id,
      report_type,
      item_name,
      category,
      public_description,
      building,
      event_at,
      report_status
    ) values (
      '10000000-0000-0000-0000-000000000382',
      '00000000-0000-0000-0000-000000000382',
      'LOST',
      'Wireless mouse',
      'Elektronik',
      'Mouse nirkabel hitam hilang di ruang kelas lantai tiga.',
      'Gedung R',
      now(),
      'DRAFT'
    )
  $$,
  '42501',
  null,
  'unverified student remains blocked by report RLS'
);

reset role;
select * from finish();
rollback;
