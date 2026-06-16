begin;

select plan(6);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000301', 'authenticated', 'authenticated', 'studentone.535240301@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Studentone Access","nim":"535240301"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000302', 'authenticated', 'authenticated', 'studenttwo.825250302@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Studenttwo Access","nim":"825250302"}'::jsonb, now(), now());

update public.profiles
set
  verification_status = 'VERIFIED'::public.profile_verification_status,
  verified_at = coalesce(verified_at, now())
where id in (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000302'
);

insert into public.reports (id, reporter_id, report_type, item_name, category, public_description, private_characteristics, building, event_at, report_status, custody_status, published_at)
values
  ('10000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301', 'LOST', 'Black wallet', 'Wallet', 'Black wallet lost near the library entrance', 'Initials are embossed inside', 'Gedung M', now(), 'PUBLISHED', 'UNKNOWN', now()),
  ('10000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000302', 'FOUND', 'Silver charger', 'Electronics', 'Silver laptop charger found in a classroom', 'Cable has a private label', 'Gedung R', now(), 'PUBLISHED', 'AT_DPM', now());

set local role anon;
select is((select count(*)::integer from public.public_reports), 2, 'anonymous sees public reports');
select throws_ok($$ select count(*) from public.reports $$, '42501', null, 'anonymous cannot read base reports');

reset role;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000301';
set local role authenticated;
select is(public.current_app_role()::text, 'student', 'student role resolves from profile');
select is((select count(*)::integer from public.profiles), 1, 'student sees own profile only');
select is((select count(*)::integer from public.reports where id = '10000000-0000-0000-0000-000000000302'), 0, 'student cannot read another base report');
select lives_ok(
  $$ insert into public.claims (report_id, claimant_id, ownership_evidence_private)
     values ('10000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000301', 'The cable label contains my initials') $$,
  'student can claim another published found report'
);

reset role;
select * from finish();
rollback;
