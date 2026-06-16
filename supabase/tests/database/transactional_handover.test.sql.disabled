begin;

select plan(24);

select has_function(
  'public',
  'complete_handover',
  array['uuid', 'text', 'text'],
  'complete_handover RPC exists'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('53521000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'handoverowner.535241001@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Handover Owner","nim":"535241001"}'::jsonb, now(), now()),
  ('53521000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'handoverclaimant.535241002@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Handover Claimant","nim":"535241002"}'::jsonb, now(), now()),
  ('53521000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'handoverstudent.535241003@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Handover Student","nim":"535241003"}'::jsonb, now(), now()),
  ('53521000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'handoververifier.535241004@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Handover Verifier","nim":"535241004"}'::jsonb, now(), now());

update public.profiles
set role = 'verifier'::public.application_role
where id = '53521000-0000-0000-0000-000000000004';

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
  ('21000000-0000-4000-8000-000000000001', '53521000-0000-0000-0000-000000000001', 'FOUND', 'Blue tumbler', 'Botol & Wadah', 'Blue tumbler found near the DPM desk', 'Sticker under cap', 'Gedung R', now(), 'MATCHING', 'AT_DPM', now()),
  ('21000000-0000-4000-8000-000000000002', '53521000-0000-0000-0000-000000000001', 'FOUND', 'Silver charger', 'Elektronik', 'Silver charger found in lab hallway', 'Initials on cable', 'Gedung L', now(), 'MATCHING', 'UNKNOWN', now()),
  ('21000000-0000-4000-8000-000000000003', '53521000-0000-0000-0000-000000000001', 'FOUND', 'Black umbrella', 'Aksesori', 'Black umbrella found beside classroom', 'Private mark on handle', 'Gedung M', now(), 'PUBLISHED', 'WITH_FINDER', now()),
  ('21000000-0000-4000-8000-000000000004', '53521000-0000-0000-0000-000000000001', 'FOUND', 'Red notebook', 'Alat Tulis', 'Red notebook found near library table', 'Name hidden on last page', 'Gedung L', now(), 'MATCHING', 'WITH_FINDER', now());

insert into public.claims (
  id,
  report_id,
  claimant_id,
  ownership_evidence_private,
  claim_status,
  decided_by,
  decided_at,
  decision_reason,
  expires_at
) values
  ('21100000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '53521000-0000-0000-0000-000000000002', 'The tumbler has a triangle sticker under the cap', 'APPROVED', '53521000-0000-0000-0000-000000000004', '2026-06-15 08:00:00+00', 'Evidence matches the private mark', '2026-06-20 08:00:00+00'),
  ('21100000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', '53521000-0000-0000-0000-000000000002', 'The charger cable has my initials near the plug', 'PENDING', null, null, null, null),
  ('21100000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000003', '53521000-0000-0000-0000-000000000002', 'The umbrella handle has a private scratch pattern', 'APPROVED', '53521000-0000-0000-0000-000000000004', '2026-06-15 09:00:00+00', 'Evidence matches umbrella', null),
  ('21100000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000004', '53521000-0000-0000-0000-000000000002', 'The notebook last page has my small signature mark', 'APPROVED', '53521000-0000-0000-0000-000000000004', '2026-06-15 10:00:00+00', 'Evidence matches notebook', null);

set local role anon;

select throws_ok(
  $$ select * from public.complete_handover('21100000-0000-4000-8000-000000000001', 'Pos DPM FTI', null) $$,
  '42501',
  null,
  'anonymous execution is denied'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53521000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$ select * from public.complete_handover('21100000-0000-4000-8000-000000000001', 'Pos DPM FTI', null) $$,
  null,
  'student execution is denied'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53521000-0000-0000-0000-000000000004', true);

select lives_ok(
  $$ select * from public.complete_handover('21100000-0000-4000-8000-000000000001', '  Pos DPM FTI  ', 'Receiver ID checked') $$,
  'verifier can complete an APPROVED claim'
);

select is((select count(*)::integer from public.handovers where claim_id = '21100000-0000-4000-8000-000000000001'), 1, 'one handover row is created');
select is((select report_id from public.handovers where claim_id = '21100000-0000-4000-8000-000000000001'), '21000000-0000-4000-8000-000000000001'::uuid, 'handover report_id matches the claim');
select is((select recipient_id from public.handovers where claim_id = '21100000-0000-4000-8000-000000000001'), '53521000-0000-0000-0000-000000000002'::uuid, 'handover recipient_id equals claimant_id');
select is((select verifier_id from public.handovers where claim_id = '21100000-0000-4000-8000-000000000001'), '53521000-0000-0000-0000-000000000004'::uuid, 'handover verifier_id equals auth.uid()');
select isnt((select handover_at from public.handovers where claim_id = '21100000-0000-4000-8000-000000000001'), null, 'handover timestamp is populated');
select is((select claim_status::text from public.claims where id = '21100000-0000-4000-8000-000000000001'), 'COMPLETED', 'claim becomes COMPLETED');
select is(
  (select decided_by::text || '/' || decision_reason from public.claims where id = '21100000-0000-4000-8000-000000000001'),
  '53521000-0000-0000-0000-000000000004/Evidence matches the private mark',
  'original approval decision fields remain unchanged'
);
select is(
  (select report_status::text || '/' || custody_status::text from public.reports where id = '21000000-0000-4000-8000-000000000001'),
  'RESOLVED/HANDED_OVER',
  'report becomes RESOLVED and custody becomes HANDED_OVER'
);
select isnt((select resolved_at from public.reports where id = '21000000-0000-4000-8000-000000000001'), null, 'resolved_at is populated');
select is((select count(*)::integer from public.audit_logs where action = 'HANDOVER_COMPLETED' and entity_type = 'handover'), 1, 'HANDOVER_COMPLETED audit exists');
select is((select count(*)::integer from public.audit_logs where action = 'CLAIM_COMPLETED' and entity_id = '21100000-0000-4000-8000-000000000001'), 1, 'CLAIM_COMPLETED audit exists');
select is((select count(*)::integer from public.audit_logs where action = 'REPORT_RESOLVED_BY_HANDOVER' and entity_id = '21000000-0000-4000-8000-000000000001'), 1, 'REPORT_RESOLVED_BY_HANDOVER audit exists');
select is((select count(*)::integer from public.audit_logs where actor_id = '53521000-0000-0000-0000-000000000004' and action in ('HANDOVER_COMPLETED', 'CLAIM_COMPLETED', 'REPORT_RESOLVED_BY_HANDOVER')), 3, 'audit actor equals the verifier');

select throws_ok(
  $$ select * from public.complete_handover('21100000-0000-4000-8000-000000000001', 'Pos DPM FTI', null) $$,
  null,
  'repeated handover is rejected'
);

select is((select count(*)::integer from public.handovers where report_id = '21000000-0000-4000-8000-000000000001'), 1, 'duplicate handover row is not created');

select throws_ok(
  $$ select * from public.complete_handover('21100000-0000-4000-8000-000000000002', 'Pos DPM FTI', null) $$,
  null,
  'PENDING claim cannot be handed over'
);

select throws_ok(
  $$ select * from public.complete_handover('21100000-0000-4000-8000-000000000003', 'Pos DPM FTI', null) $$,
  null,
  'PUBLISHED report cannot be handed over'
);

select throws_ok(
  $$ select * from public.complete_handover('21100000-0000-4000-8000-000000000004', 'No', null) $$,
  null,
  'invalid location is rejected'
);

select is(
  (
    select claims.claim_status::text || '/' || reports.report_status::text || '/' || count(handovers.id)::text
    from public.claims
    join public.reports on reports.id = claims.report_id
    left join public.handovers on handovers.claim_id = claims.id
    where claims.id = '21100000-0000-4000-8000-000000000004'
    group by claims.claim_status, reports.report_status
  ),
  'APPROVED/MATCHING/0',
  'invalid location causes no state changes'
);

select throws_ok(
  $$ select * from public.set_report_custody_status('21000000-0000-4000-8000-000000000004', 'HANDED_OVER'::public.custody_status, 'Manual handover attempt') $$,
  null,
  'manual custody RPC cannot set HANDED_OVER'
);

reset role;

select * from finish();
rollback;
