begin;

select plan(33);

select is(
  (
    select name
    from public.organizations
    where code = 'UNTAR_FTI'
  ),
  'Fakultas Teknologi Informasi Universitas Tarumanagara',
  'UNTAR organization exists'
);

select is(
  (
    select program_study_name
    from public.nim_prefixes
    where prefix = '535'
  ),
  'Teknik Informatika',
  'prefix 535 maps to Teknik Informatika'
);

select is(
  (
    select program_study_name
    from public.nim_prefixes
    where prefix = '825'
  ),
  'Sistem Informasi',
  'prefix 825 maps to Sistem Informasi'
);

select is(
  (
    select allowed_cohorts
    from public.nim_prefixes
    where prefix = '535'
  ),
  array[24, 25]::smallint[],
  'allowed cohorts are 24 and 25'
);

select is(
  (
    select count(*)::integer
    from pg_proc
    where oid in (
      'public.normalize_auth_first_name(text)'::regprocedure,
      'public.resolve_institutional_identity(text,text,text)'::regprocedure,
      'public.on_auth_user_created()'::regprocedure,
      'public.on_auth_user_email_confirmed()'::regprocedure,
      'public.protect_institutional_email_change()'::regprocedure
    )
      and not (
        'search_path=' = any(coalesce(proconfig, array[]::text[]))
        or 'search_path=""' = any(coalesce(proconfig, array[]::text[]))
      )
  ),
  0,
  'new auth functions pin an empty search_path'
);

select is(
  (
    select count(*)::integer
    from pg_proc
    cross join (values ('PUBLIC'), ('anon'), ('authenticated')) as roles(role_name)
    where oid in (
      'public.normalize_auth_first_name(text)'::regprocedure,
      'public.resolve_institutional_identity(text,text,text)'::regprocedure,
      'public.on_auth_user_created()'::regprocedure,
      'public.on_auth_user_email_confirmed()'::regprocedure,
      'public.protect_institutional_email_change()'::regprocedure
    )
      and has_function_privilege(roles.role_name, oid, 'EXECUTE')
  ),
  0,
  'PUBLIC, anon, and authenticated cannot execute new auth functions directly'
);

select lives_ok(
  $$
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
      '00000000-0000-0000-0000-000000000201',
      'authenticated',
      'authenticated',
      'alpha.535240143@stu.untar.ac.id',
      '',
      null,
      '{}'::jsonb,
      '{"full_name": "Alpha Student", "nim": "535240143"}'::jsonb,
      now(),
      now()
    )
  $$,
  'valid TI auth user can be created'
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000201'
  ),
  1,
  'valid TI auth user creates exactly one profile'
);

select results_eq(
  $$
    select
      nim,
      nim_prefix,
      program_study_code,
      cohort_year,
      role::text,
      verification_status::text
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000201'
  $$,
  $$
    values (
      '535240143'::text,
      '535'::text,
      'TI'::text,
      2024::smallint,
      'student'::text,
      'PENDING_EMAIL'::text
    )
  $$,
  '535240143 derives TI, 2024, student, and PENDING_EMAIL'
);

select lives_ok(
  $$
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
      '00000000-0000-0000-0000-000000000202',
      'authenticated',
      'authenticated',
      'beta.825250118@stu.untar.ac.id',
      '',
      now(),
      '{}'::jsonb,
      '{"full_name": "Beta Student", "nim": "825250118"}'::jsonb,
      now(),
      now()
    )
  $$,
  'valid SI confirmed auth user can be created'
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000202'
  ),
  1,
  'valid SI auth user creates exactly one profile'
);

select results_eq(
  $$
    select
      nim,
      nim_prefix,
      program_study_code,
      cohort_year,
      verification_status::text
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000202'
  $$,
  $$
    values (
      '825250118'::text,
      '825'::text,
      'SI'::text,
      2025::smallint,
      'VERIFIED'::text
    )
  $$,
  '825250118 derives SI, 2025, and VERIFIED'
);

select lives_ok(
  $$
    update auth.users
    set email_confirmed_at = now()
    where id = '00000000-0000-0000-0000-000000000201'
  $$,
  'confirming email succeeds'
);

select is(
  (
    select verification_status::text
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000201'
  ),
  'VERIFIED',
  'confirming email updates profile verification status'
);

select isnt(
  (
    select verified_at
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000201'
  ),
  null,
  'confirming email sets verified_at'
);

select throws_ok(
  $$
    insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000203', 'authenticated', 'authenticated', 'gamma.535240203@example.test', '', '{}'::jsonb, '{"full_name": "Gamma Student", "nim": "535240203"}'::jsonb, now(), now())
  $$,
  'P0001',
  null,
  'wrong domain rejected'
);

select throws_ok(
  $$
    insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000204', 'authenticated', 'authenticated', 'wrong.535240204@stu.untar.ac.id', '', '{}'::jsonb, '{"full_name": "Delta Student", "nim": "535240204"}'::jsonb, now(), now())
  $$,
  'P0001',
  null,
  'wrong first-name token rejected'
);

select throws_ok(
  $$
    insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000205', 'authenticated', 'authenticated', 'epsilon.535240205@stu.untar.ac.id', '', '{}'::jsonb, '{"full_name": "Epsilon Student", "nim": "535240206"}'::jsonb, now(), now())
  $$,
  'P0001',
  null,
  'email and NIM mismatch rejected'
);

select throws_ok(
  $$
    insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000206', 'authenticated', 'authenticated', 'zeta.123240206@stu.untar.ac.id', '', '{}'::jsonb, '{"full_name": "Zeta Student", "nim": "123240206"}'::jsonb, now(), now())
  $$,
  'P0001',
  null,
  'unknown prefix rejected'
);

select throws_ok(
  $$
    insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000207', 'authenticated', 'authenticated', 'eta.535230207@stu.untar.ac.id', '', '{}'::jsonb, '{"full_name": "Eta Student", "nim": "535230207"}'::jsonb, now(), now())
  $$,
  'P0001',
  null,
  'invalid cohort rejected'
);

select throws_ok(
  $$
    insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000208', 'authenticated', 'authenticated', 'theta.53524020@stu.untar.ac.id', '', '{}'::jsonb, '{"full_name": "Theta Student", "nim": "53524020"}'::jsonb, now(), now())
  $$,
  'P0001',
  null,
  'wrong NIM length rejected'
);

select throws_ok(
  $$
    insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000209', 'authenticated', 'authenticated', 'duplicate.535240143@stu.untar.ac.id', '', '{}'::jsonb, '{"full_name": "Duplicate Student", "nim": "535240143"}'::jsonb, now(), now())
  $$,
  '23505',
  null,
  'duplicate NIM rejected'
);

select lives_ok(
  $$
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
      '00000000-0000-0000-0000-000000000210',
      'authenticated',
      'authenticated',
      'forged.535240210@stu.untar.ac.id',
      '',
      null,
      '{}'::jsonb,
      '{"full_name": "Forged Student", "nim": "535240210", "role": "admin", "organization_id": "00000000-0000-0000-0000-000000000000", "program_study_code": "SI", "cohort_year": 2025, "verification_status": "VERIFIED"}'::jsonb,
      now(),
      now()
    )
  $$,
  'forged browser metadata does not block valid signup'
);

select results_eq(
  $$
    select
      role::text,
      organization_id,
      nim_prefix,
      program_study_code,
      cohort_year,
      verification_status::text
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000210'
  $$,
  $$
    values (
      'student'::text,
      '40000000-0000-0000-0000-000000000001'::uuid,
      '535'::text,
      'TI'::text,
      2024::smallint,
      'PENDING_EMAIL'::text
    )
  $$,
  'forged role and institutional metadata are ignored'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);

select results_eq(
  $$ select id from public.profiles order by id $$,
  $$ values ('00000000-0000-0000-0000-000000000201'::uuid) $$,
  'user A can read profile A only'
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000202'
  ),
  0,
  'user A cannot read profile B'
);

select throws_ok(
  $$
    insert into public.profiles (id, role, display_name)
    values ('00000000-0000-0000-0000-000000000250', 'student', 'Browser Insert')
  $$,
  '42501',
  null,
  'authenticated user cannot directly insert profile'
);

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = auth.uid() $$,
  '42501',
  null,
  'authenticated user cannot directly update trusted profile fields'
);

select throws_ok(
  $$ delete from public.profiles where id = auth.uid() $$,
  '42501',
  null,
  'authenticated user cannot directly delete profile'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$ select count(*)::integer from public.profiles $$,
  '42501',
  null,
  'anonymous user cannot read profiles'
);

reset role;

select throws_ok(
  $$ update auth.users set email = 'alpha.535240143@example.test' where id = '00000000-0000-0000-0000-000000000201' $$,
  'P0001',
  null,
  'invalid domain email change rejected'
);

select throws_ok(
  $$ update auth.users set email = 'alpha.825250118@stu.untar.ac.id' where id = '00000000-0000-0000-0000-000000000201' $$,
  'P0001',
  null,
  'email with another NIM rejected'
);

select lives_ok(
  $$ update auth.users set email = 'ALPHA.535240143@STU.UNTAR.AC.ID' where id = '00000000-0000-0000-0000-000000000201' $$,
  'compliant institutional email remains valid'
);

select * from finish();

rollback;
