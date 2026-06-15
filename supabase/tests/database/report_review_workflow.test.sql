begin;

select plan(20);

select has_function(
  'public',
  'review_report',
  array['uuid', 'public.report_review_decision', 'text'],
  'review_report RPC exists'
);

select has_function(
  'public',
  'set_report_custody_status',
  array['uuid', 'public.custody_status', 'text'],
  'custody RPC exists'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('53500000-0000-0000-0000-000000000018', 'authenticated', 'authenticated', 'reviewstudent.535240518@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Reviewstudent Owner","nim":"535240518"}'::jsonb, now(), now()),
  ('53500000-0000-0000-0000-000000000118', 'authenticated', 'authenticated', 'reviewverifier.535240118@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Reviewverifier User","nim":"535240118"}'::jsonb, now(), now());

update public.profiles
set role = 'verifier'::public.application_role
where id = '53500000-0000-0000-0000-000000000118';

insert into public.reports (
  id,
  reporter_id,
  report_type,
  item_name,
  category,
  public_description,
  private_characteristics,
  campus,
  building,
  location_detail,
  event_at,
  report_status,
  custody_status
) values
  (
    '18000000-0000-0000-0000-000000000001',
    '53500000-0000-0000-0000-000000000018',
    'LOST',
    'Black wallet',
    'Dompet',
    'Black wallet lost near the lobby entrance',
    'Initials hidden inside',
    'Kampus 1',
    'Gedung R',
    'Dekat lift utama',
    now(),
    'PENDING_REVIEW',
    'UNKNOWN'
  ),
  (
    '18000000-0000-0000-0000-000000000002',
    '53500000-0000-0000-0000-000000000018',
    'FOUND',
    'Blue umbrella',
    'Aksesori',
    'Blue umbrella found beside classroom door',
    'Sticker hidden under handle',
    'Kampus 1',
    'Gedung M',
    'Ruang kelas 402',
    now(),
    'PENDING_REVIEW',
    'WITH_FINDER'
  ),
  (
    '18000000-0000-0000-0000-000000000003',
    '53500000-0000-0000-0000-000000000018',
    'FOUND',
    'Silver charger',
    'Elektronik',
    'Silver charger found in the library',
    'Cable has private label',
    'Kampus 1',
    'Gedung L',
    'Meja baca',
    now(),
    'PUBLISHED',
    'UNKNOWN'
  );

set local role anon;
select throws_ok(
  $$ select * from public.review_report('18000000-0000-0000-0000-000000000001', 'APPROVE'::public.report_review_decision, 'Valid reason') $$,
  '42501',
  null,
  'anonymous review is denied'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53500000-0000-0000-0000-000000000018', true);

select throws_ok(
  $$ select * from public.review_report('18000000-0000-0000-0000-000000000001', 'APPROVE'::public.report_review_decision, 'Valid reason') $$,
  null,
  'student review is denied'
);

select throws_ok(
  $$ select * from public.set_report_custody_status('18000000-0000-0000-0000-000000000003', 'AT_DPM'::public.custody_status, 'Valid reason') $$,
  null,
  'student cannot change custody'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53500000-0000-0000-0000-000000000118', true);

select lives_ok(
  $$ select * from public.review_report('18000000-0000-0000-0000-000000000001', 'APPROVE'::public.report_review_decision, 'Looks valid') $$,
  'verifier can approve PENDING_REVIEW'
);

select is(
  (select report_status::text from public.reports where id = '18000000-0000-0000-0000-000000000001'),
  'PUBLISHED',
  'approved report becomes PUBLISHED'
);

select is(
  (select reviewed_by from public.reports where id = '18000000-0000-0000-0000-000000000001'),
  '53500000-0000-0000-0000-000000000118'::uuid,
  'reviewed_by equals verifier'
);

select isnt(
  (select reviewed_at from public.reports where id = '18000000-0000-0000-0000-000000000001'),
  null,
  'reviewed_at is populated'
);

select isnt(
  (select published_at from public.reports where id = '18000000-0000-0000-0000-000000000001'),
  null,
  'published_at is populated'
);

select is(
  (select count(*)::integer from public.audit_logs where entity_id = '18000000-0000-0000-0000-000000000001' and action = 'REPORT_REVIEW_APPROVED'),
  1,
  'exactly one approval audit event exists'
);

select is(
  (select actor_id from public.audit_logs where entity_id = '18000000-0000-0000-0000-000000000001' and action = 'REPORT_REVIEW_APPROVED'),
  '53500000-0000-0000-0000-000000000118'::uuid,
  'audit actor equals verifier'
);

select is(
  (select before_data ->> 'report_status' from public.audit_logs where entity_id = '18000000-0000-0000-0000-000000000001' and action = 'REPORT_REVIEW_APPROVED'),
  'PENDING_REVIEW',
  'audit before status is PENDING_REVIEW'
);

select is(
  (select after_data ->> 'report_status' from public.audit_logs where entity_id = '18000000-0000-0000-0000-000000000001' and action = 'REPORT_REVIEW_APPROVED'),
  'PUBLISHED',
  'audit after status is PUBLISHED'
);

select lives_ok(
  $$ select * from public.review_report('18000000-0000-0000-0000-000000000002', 'REJECT'::public.report_review_decision, 'Insufficient public detail') $$,
  'verifier can reject another pending report'
);

select is(
  (select rejection_reason from public.reports where id = '18000000-0000-0000-0000-000000000002'),
  'Insufficient public detail',
  'rejected report stores rejection reason'
);

select throws_ok(
  $$ select * from public.review_report('18000000-0000-0000-0000-000000000002', 'REJECT'::public.report_review_decision, 'Second review') $$,
  null,
  'repeated review is rejected'
);

select lives_ok(
  $$ select * from public.set_report_custody_status('18000000-0000-0000-0000-000000000003', 'AT_DPM'::public.custody_status, 'Stored at DPM desk') $$,
  'verifier can change custody'
);

select is(
  (select count(*)::integer from public.audit_logs where entity_id = '18000000-0000-0000-0000-000000000003' and action = 'REPORT_CUSTODY_CHANGED'),
  1,
  'custody change creates exactly one audit event'
);

select throws_ok(
  $$ select * from public.set_report_custody_status('18000000-0000-0000-0000-000000000003', 'AT_DPM'::public.custody_status, 'No status change') $$,
  null,
  'no-op custody change is rejected'
);

reset role;

select * from finish();
rollback;
