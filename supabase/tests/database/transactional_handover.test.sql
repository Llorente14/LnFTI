begin;

select plan(8);

select has_function(
  'public',
  'complete_handover',
  array['uuid', 'text', 'text'],
  'complete_handover RPC exists'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('53526000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'handoverowner.535260001@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Handoverowner User","nim":"535260001"}'::jsonb, now(), now()),
  ('53526000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'handoverclaimant.535260002@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Handoverclaimant User","nim":"535260002"}'::jsonb, now(), now()),
  ('53526000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'handoververifier.535260003@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Handoververifier User","nim":"535260003"}'::jsonb, now(), now());

update public.profiles
set role = 'verifier'::public.application_role
where id = '53526000-0000-4000-8000-000000000003';

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
) values (
  '26000000-0000-4000-8000-000000000001',
  '53526000-0000-4000-8000-000000000001',
  'FOUND',
  'Transactional umbrella',
  'Lainnya',
  'Umbrella found near the test handover location',
  'Private handle mark',
  'Gedung R',
  now(),
  'MATCHING',
  'AT_DPM',
  now()
);

insert into public.claims (
  id,
  report_id,
  claimant_id,
  ownership_evidence_private,
  claim_status,
  decided_by,
  decided_at,
  decision_reason
) values (
  '26000000-0000-4000-8000-000000000002',
  '26000000-0000-4000-8000-000000000001',
  '53526000-0000-4000-8000-000000000002',
  'Claimant knows the private handle mark',
  'APPROVED',
  '53526000-0000-4000-8000-000000000003',
  now(),
  'Private evidence matches'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '53526000-0000-4000-8000-000000000003', true);

select lives_ok(
  $$ select * from public.complete_handover('26000000-0000-4000-8000-000000000002', '  Pos DPM FTI  ', '   ') $$,
  'verifier can complete handover with blank optional notes'
);

reset role;

select is(
  (select claim_status::text from public.claims where id = '26000000-0000-4000-8000-000000000002'),
  'COMPLETED',
  'handover completes claim'
);

select is(
  (select report_status::text from public.reports where id = '26000000-0000-4000-8000-000000000001'),
  'RESOLVED',
  'handover resolves report'
);

select is(
  (select custody_status::text from public.reports where id = '26000000-0000-4000-8000-000000000001'),
  'HANDED_OVER',
  'handover updates custody'
);

select is(
  (select handover_location from public.handovers where claim_id = '26000000-0000-4000-8000-000000000002'),
  'Pos DPM FTI',
  'handover location is trimmed'
);

select is(
  (select notes from public.handovers where claim_id = '26000000-0000-4000-8000-000000000002'),
  null::text,
  'blank handover notes are stored as null'
);

select is(
  (select count(*)::integer from public.handovers where report_id = '26000000-0000-4000-8000-000000000001'),
  1,
  'one handover row is created'
);

select * from finish();
rollback;
