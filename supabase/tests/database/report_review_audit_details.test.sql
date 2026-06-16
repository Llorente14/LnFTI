begin;

select plan(13);

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
) values
  (
    '53500000-0000-0000-0000-000000000028',
    'authenticated',
    'authenticated',
    'auditstudent.535240528@stu.untar.ac.id',
    '',
    now(),
    '{}'::jsonb,
    '{"full_name":"Auditstudent Owner","nim":"535240528"}'::jsonb,
    now(),
    now()
  ),
  (
    '53500000-0000-0000-0000-000000000128',
    'authenticated',
    'authenticated',
    'auditverifier.535240128@stu.untar.ac.id',
    '',
    now(),
    '{}'::jsonb,
    '{"full_name":"Auditverifier User","nim":"535240128"}'::jsonb,
    now(),
    now()
  );

update public.profiles
set role = 'verifier'::public.application_role
where id = '53500000-0000-0000-0000-000000000128';

update public.profiles
set
  verification_status = 'VERIFIED'::public.profile_verification_status,
  verified_at = coalesce(verified_at, now())
where id = '53500000-0000-0000-0000-000000000028';

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
  custody_status
) values
  (
    '18000000-0000-4000-8000-000000000028',
    '53500000-0000-0000-0000-000000000028',
    'FOUND',
    'Black pouch',
    'Tas',
    'Black pouch found near the laboratory entrance.',
    'Small initials inside the pouch.',
    'Gedung R',
    now(),
    'PENDING_REVIEW',
    'WITH_FINDER'
  ),
  (
    '18000000-0000-4000-8000-000000000029',
    '53500000-0000-0000-0000-000000000028',
    'FOUND',
    'Blue bottle',
    'Botol & Wadah',
    'Blue bottle found beside the classroom door.',
    'Private sticker under the bottle.',
    'Gedung M',
    now(),
    'PUBLISHED',
    'UNKNOWN'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '53500000-0000-0000-0000-000000000028', true);

select throws_ok(
  $$
    update public.reports
    set report_status = 'PUBLISHED'::public.report_status
    where id = '18000000-0000-4000-8000-000000000028'
  $$,
  '42501',
  null,
  'student cannot directly publish a pending report'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53500000-0000-0000-0000-000000000128', true);

select lives_ok(
  $$
    select *
    from public.review_report(
      '18000000-0000-4000-8000-000000000028',
      'REJECT'::public.report_review_decision,
      'Public description is insufficient'
    )
  $$,
  'verifier can reject a pending report'
);

select is(
  (
    select actor_id
    from public.audit_logs
    where entity_id = '18000000-0000-4000-8000-000000000028'
      and action = 'REPORT_REVIEW_REJECTED'
  ),
  '53500000-0000-0000-0000-000000000128'::uuid,
  'rejection audit records the verifier actor'
);

select isnt(
  (
    select created_at
    from public.audit_logs
    where entity_id = '18000000-0000-4000-8000-000000000028'
      and action = 'REPORT_REVIEW_REJECTED'
  ),
  null,
  'rejection audit records a timestamp'
);

select is(
  (
    select before_data ->> 'report_status'
    from public.audit_logs
    where entity_id = '18000000-0000-4000-8000-000000000028'
      and action = 'REPORT_REVIEW_REJECTED'
  ),
  'PENDING_REVIEW',
  'rejection audit records the previous status'
);

select is(
  (
    select after_data ->> 'report_status'
    from public.audit_logs
    where entity_id = '18000000-0000-4000-8000-000000000028'
      and action = 'REPORT_REVIEW_REJECTED'
  ),
  'REJECTED',
  'rejection audit records the new status'
);

select is(
  (
    select metadata ->> 'reason'
    from public.audit_logs
    where entity_id = '18000000-0000-4000-8000-000000000028'
      and action = 'REPORT_REVIEW_REJECTED'
  ),
  'Public description is insufficient',
  'rejection audit records the reason'
);

select lives_ok(
  $$
    select *
    from public.set_report_custody_status(
      '18000000-0000-4000-8000-000000000029',
      'AT_DPM'::public.custody_status,
      'Stored securely at the DPM desk'
    )
  $$,
  'verifier can change report custody'
);

select is(
  (
    select actor_id
    from public.audit_logs
    where entity_id = '18000000-0000-4000-8000-000000000029'
      and action = 'REPORT_CUSTODY_CHANGED'
  ),
  '53500000-0000-0000-0000-000000000128'::uuid,
  'custody audit records the verifier actor'
);

select isnt(
  (
    select created_at
    from public.audit_logs
    where entity_id = '18000000-0000-4000-8000-000000000029'
      and action = 'REPORT_CUSTODY_CHANGED'
  ),
  null,
  'custody audit records a timestamp'
);

select is(
  (
    select before_data ->> 'custody_status'
    from public.audit_logs
    where entity_id = '18000000-0000-4000-8000-000000000029'
      and action = 'REPORT_CUSTODY_CHANGED'
  ),
  'UNKNOWN',
  'custody audit records the previous status'
);

select is(
  (
    select after_data ->> 'custody_status'
    from public.audit_logs
    where entity_id = '18000000-0000-4000-8000-000000000029'
      and action = 'REPORT_CUSTODY_CHANGED'
  ),
  'AT_DPM',
  'custody audit records the new status'
);

select is(
  (
    select metadata ->> 'reason'
    from public.audit_logs
    where entity_id = '18000000-0000-4000-8000-000000000029'
      and action = 'REPORT_CUSTODY_CHANGED'
  ),
  'Stored securely at the DPM desk',
  'custody audit records the reason'
);

select * from finish();
rollback;
