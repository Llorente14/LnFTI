begin;

select plan(8);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '53521100-0000-0000-0000-000000000011',
    'authenticated', 'authenticated',
    'hardowner.535241011@stu.untar.ac.id', '', now(), '{}'::jsonb,
    '{"full_name":"Hardowner Student","nim":"535241011"}'::jsonb,
    now(), now()
  ),
  (
    '53521100-0000-0000-0000-000000000012',
    'authenticated', 'authenticated',
    'hardclaimant.535241012@stu.untar.ac.id', '', now(), '{}'::jsonb,
    '{"full_name":"Hardclaimant Student","nim":"535241012"}'::jsonb,
    now(), now()
  ),
  (
    '53521100-0000-0000-0000-000000000014',
    'authenticated', 'authenticated',
    'hardverifier.535241014@stu.untar.ac.id', '', now(), '{}'::jsonb,
    '{"full_name":"Hardverifier Staff","nim":"535241014"}'::jsonb,
    now(), now()
  );

update public.profiles
set role = 'verifier'::public.application_role
where id = '53521100-0000-0000-0000-000000000014';

insert into public.reports (
  id, reporter_id, report_type, item_name, category,
  public_description, private_characteristics, building, event_at,
  report_status, custody_status, published_at
) values (
  '21200000-0000-4000-8000-000000000011',
  '53521100-0000-0000-0000-000000000011',
  'FOUND', 'Green pouch', 'Tas & Dompet',
  'Green pouch found near the library counter',
  'Small stitched initials inside', 'Gedung M', now(),
  'MATCHING', 'AT_DPM', now()
);

insert into public.claims (
  id, report_id, claimant_id, ownership_evidence_private,
  claim_status, decided_by, decided_at, decision_reason
) values (
  '21210000-0000-4000-8000-000000000011',
  '21200000-0000-4000-8000-000000000011',
  '53521100-0000-0000-0000-000000000012',
  'The inner lining contains my stitched initials and a hidden pocket.',
  'APPROVED',
  '53521100-0000-0000-0000-000000000014',
  now(),
  'Evidence matches the private characteristics.'
);

-- Simulate an institutional email change after approval.
update public.profiles
set verification_status = 'PENDING_EMAIL'::public.profile_verification_status,
    verified_at = null
where id = '53521100-0000-0000-0000-000000000012';

set local role authenticated;
select set_config('request.jwt.claim.sub', '53521100-0000-0000-0000-000000000014', true);

select throws_ok(
  $$ select * from public.complete_handover(
    '21210000-0000-4000-8000-000000000011',
    'Pos DPM FTI',
    'Recipient identity checked'
  ) $$,
  null,
  'handover rejects a claimant whose institutional profile is no longer verified'
);

select is(
  (select count(*)::integer from public.handovers where claim_id = '21210000-0000-4000-8000-000000000011'),
  0,
  'failed verification creates no handover row'
);

select is(
  (select claim_status::text from public.claims where id = '21210000-0000-4000-8000-000000000011'),
  'APPROVED',
  'failed verification keeps the claim approved'
);

select is(
  (
    select report_status::text || '/' || custody_status::text
    from public.reports
    where id = '21200000-0000-4000-8000-000000000011'
  ),
  'MATCHING/AT_DPM',
  'failed verification keeps report and custody state unchanged'
);

reset role;

update public.profiles
set verification_status = 'VERIFIED'::public.profile_verification_status,
    verified_at = now()
where id = '53521100-0000-0000-0000-000000000012';

set local role authenticated;
select set_config('request.jwt.claim.sub', '53521100-0000-0000-0000-000000000014', true);

select lives_ok(
  $$ select * from public.complete_handover(
    '21210000-0000-4000-8000-000000000011',
    'Pos DPM FTI',
    'Recipient identity checked'
  ) $$,
  'handover succeeds after the claimant is verified again'
);

select is(
  (
    select (handovers.handover_at = reports.resolved_at)::text
    from public.handovers
    join public.reports on reports.id = handovers.report_id
    where handovers.claim_id = '21210000-0000-4000-8000-000000000011'
  ),
  'true',
  'handover and report resolution use the same transaction timestamp'
);

select is(
  (select claim_status::text from public.claims where id = '21210000-0000-4000-8000-000000000011'),
  'COMPLETED',
  'successful handover completes the claim'
);

select ok(
  not exists (
    select 1
    from public.audit_logs
    where action = 'HANDOVER_COMPLETED'
      and entity_id in (
        select id from public.handovers
        where claim_id = '21210000-0000-4000-8000-000000000011'
      )
      and (
        after_data ? 'notes'
        or metadata ? 'notes'
        or after_data::text like '%Recipient identity checked%'
        or metadata::text like '%Recipient identity checked%'
      )
  ),
  'operational handover notes are excluded from audit payloads'
);

reset role;

select * from finish();
rollback;
