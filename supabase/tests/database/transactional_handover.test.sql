begin;

select plan(12);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '53521000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated',
    'handoverowner.535241001@stu.untar.ac.id', '', now(), '{}'::jsonb,
    '{"full_name":"Handover Owner","nim":"535241001"}'::jsonb,
    now(), now()
  ),
  (
    '53521000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated',
    'handoverclaimant.535241002@stu.untar.ac.id', '', now(), '{}'::jsonb,
    '{"full_name":"Handover Claimant","nim":"535241002"}'::jsonb,
    now(), now()
  ),
  (
    '53521000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated',
    'handoververifier.535241004@stu.untar.ac.id', '', now(), '{}'::jsonb,
    '{"full_name":"Handover Verifier","nim":"535241004"}'::jsonb,
    now(), now()
  );

update public.profiles
set role = 'verifier'::public.application_role
where id = '53521000-0000-0000-0000-000000000004';

insert into public.reports (
  id, reporter_id, report_type, item_name, category,
  public_description, private_characteristics, building, event_at,
  report_status, custody_status, published_at
) values (
  '21000000-0000-4000-8000-000000000001',
  '53521000-0000-0000-0000-000000000001',
  'FOUND', 'Blue tumbler', 'Botol & Wadah',
  'Blue tumbler found near the DPM desk',
  'Triangle sticker under cap', 'Gedung R', now(),
  'MATCHING', 'AT_DPM', now()
);

insert into public.claims (
  id, report_id, claimant_id, ownership_evidence_private,
  claim_status, decided_by, decided_at, decision_reason
) values (
  '21100000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  '53521000-0000-0000-0000-000000000002',
  'The tumbler has a triangle sticker under the cap.',
  'APPROVED',
  '53521000-0000-0000-0000-000000000004',
  now(),
  'Evidence matches the private mark.'
);

set local role anon;
select throws_ok(
  $$ select * from public.complete_handover(
    '21100000-0000-4000-8000-000000000001',
    'Pos DPM FTI',
    null
  ) $$,
  '42501',
  null,
  'anonymous execution is denied'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53521000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select * from public.complete_handover(
    '21100000-0000-4000-8000-000000000001',
    'Pos DPM FTI',
    null
  ) $$,
  null,
  'student execution is denied'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53521000-0000-0000-0000-000000000004', true);

select lives_ok(
  $$ select * from public.complete_handover(
    '21100000-0000-4000-8000-000000000001',
    '  Pos DPM FTI  ',
    'Receiver identity checked'
  ) $$,
  'verifier completes an approved claim atomically'
);

select is(
  (select count(*)::integer from public.handovers where claim_id = '21100000-0000-4000-8000-000000000001'),
  1,
  'exactly one handover row is created'
);

select is(
  (select recipient_id from public.handovers where claim_id = '21100000-0000-4000-8000-000000000001'),
  '53521000-0000-0000-0000-000000000002'::uuid,
  'handover recipient is the approved claimant'
);

select is(
  (select verifier_id from public.handovers where claim_id = '21100000-0000-4000-8000-000000000001'),
  '53521000-0000-0000-0000-000000000004'::uuid,
  'handover verifier is the authenticated actor'
);

select is(
  (select claim_status::text from public.claims where id = '21100000-0000-4000-8000-000000000001'),
  'COMPLETED',
  'claim becomes COMPLETED'
);

select is(
  (
    select report_status::text || '/' || custody_status::text
    from public.reports
    where id = '21000000-0000-4000-8000-000000000001'
  ),
  'RESOLVED/HANDED_OVER',
  'report becomes RESOLVED and custody becomes HANDED_OVER'
);

select is(
  (
    select (handovers.handover_at = reports.resolved_at)::text
    from public.handovers
    join public.reports on reports.id = handovers.report_id
    where handovers.claim_id = '21100000-0000-4000-8000-000000000001'
  ),
  'true',
  'handover and report resolution use one transaction timestamp'
);

select is(
  (
    select count(*)::integer
    from public.audit_logs
    where actor_id = '53521000-0000-0000-0000-000000000004'
      and action in (
        'HANDOVER_COMPLETED',
        'CLAIM_COMPLETED',
        'REPORT_RESOLVED_BY_HANDOVER'
      )
  ),
  3,
  'handover transaction writes the three required audit events'
);

select throws_ok(
  $$ select * from public.complete_handover(
    '21100000-0000-4000-8000-000000000001',
    'Pos DPM FTI',
    null
  ) $$,
  null,
  'repeated handover is rejected'
);

select throws_ok(
  $$ select * from public.set_report_custody_status(
    '21000000-0000-4000-8000-000000000001',
    'HANDED_OVER'::public.custody_status,
    'Manual handover attempt'
  ) $$,
  null,
  'manual custody RPC cannot set HANDED_OVER'
);

reset role;
select * from finish();
rollback;
