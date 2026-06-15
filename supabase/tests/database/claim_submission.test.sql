begin;

select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'claims_ownership_evidence_private_length_check'
      and conrelid = 'public.claims'::regclass
  ),
  'evidence length constraint exists'
);

select has_index(
  'public',
  'claims',
  'claims_one_active_per_claimant_report_idx',
  'active claim unique index exists'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('53519000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'claimowner.535240901@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Claimowner User","nim":"535240901"}'::jsonb, now(), now()),
  ('53519000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'claimant.535240902@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Claimant User","nim":"535240902"}'::jsonb, now(), now()),
  ('53519000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'otherclaimant.535240903@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Otherclaimant User","nim":"535240903"}'::jsonb, now(), now()),
  ('53519000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'unverified.535240904@stu.untar.ac.id', '', null, '{}'::jsonb, '{"full_name":"Unverified User","nim":"535240904"}'::jsonb, now(), now()),
  ('53519000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'verifierclaim.535240905@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Verifierclaim User","nim":"535240905"}'::jsonb, now(), now());

update public.profiles
set role = 'verifier'::public.application_role
where id = '53519000-0000-0000-0000-000000000005';

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
  ('19000000-0000-0000-0000-000000000001', '53519000-0000-0000-0000-000000000001', 'FOUND', 'Blue tumbler', 'Botol & Wadah', 'Blue tumbler found near the classroom door', 'Hidden sticker under cap', 'Gedung R', now(), 'PUBLISHED', 'UNKNOWN', now()),
  ('19000000-0000-0000-0000-000000000002', '53519000-0000-0000-0000-000000000001', 'LOST', 'Black wallet', 'Dompet', 'Black wallet lost near the library entrance', 'Private initials inside', 'Gedung M', now(), 'PUBLISHED', 'UNKNOWN', now()),
  ('19000000-0000-0000-0000-000000000003', '53519000-0000-0000-0000-000000000002', 'FOUND', 'Silver charger', 'Elektronik', 'Silver charger found beside the lab table', 'Cable has private label', 'Gedung L', now(), 'PUBLISHED', 'UNKNOWN', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '53519000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ insert into public.claims (id, report_id, claimant_id, ownership_evidence_private)
     values ('19000000-0000-0000-0000-000000000101', '19000000-0000-0000-0000-000000000001', '53519000-0000-0000-0000-000000000002', 'The cap underside has a small white triangle sticker') $$,
  'verified student can claim a public FOUND report'
);

select throws_ok(
  $$ insert into public.claims (report_id, claimant_id, ownership_evidence_private)
     values ('19000000-0000-0000-0000-000000000002', '53519000-0000-0000-0000-000000000002', 'This evidence is long enough but lost reports cannot be claimed') $$,
  null,
  'verified student cannot claim a LOST report'
);

select throws_ok(
  $$ insert into public.claims (report_id, claimant_id, ownership_evidence_private)
     values ('19000000-0000-0000-0000-000000000003', '53519000-0000-0000-0000-000000000002', 'This is my own report and should be rejected') $$,
  null,
  'student cannot claim their own report'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53519000-0000-0000-0000-000000000004', true);

select throws_ok(
  $$ insert into public.claims (report_id, claimant_id, ownership_evidence_private)
     values ('19000000-0000-0000-0000-000000000001', '53519000-0000-0000-0000-000000000004', 'Unverified account evidence should not pass insertion') $$,
  null,
  'unverified student cannot submit'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53519000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$ insert into public.claims (report_id, claimant_id, ownership_evidence_private)
     values ('19000000-0000-0000-0000-000000000001', '53519000-0000-0000-0000-000000000002', 'Duplicate active claim evidence should be rejected') $$,
  null,
  'duplicate active claim is rejected'
);

select is(
  (select ownership_evidence_private from public.claims where id = '19000000-0000-0000-0000-000000000101'),
  'The cap underside has a small white triangle sticker',
  'claimant can read their own evidence'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53519000-0000-0000-0000-000000000003', true);

select is(
  (select count(*)::integer from public.claims where id = '19000000-0000-0000-0000-000000000101'),
  0,
  'another student cannot read the evidence'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53519000-0000-0000-0000-000000000005', true);

select is(
  (select count(*)::integer from public.claims where id = '19000000-0000-0000-0000-000000000101'),
  1,
  'verifier/admin can read claims'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53519000-0000-0000-0000-000000000002', true);

update public.claims
set claim_status = 'CANCELLED'::public.claim_status
where id = '19000000-0000-0000-0000-000000000101';

reset role;

select is(
  (select claim_status::text from public.claims where id = '19000000-0000-0000-0000-000000000101'),
  'CANCELLED',
  'claimant can cancel their own PENDING claim'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '53519000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ insert into public.claims (id, report_id, claimant_id, ownership_evidence_private)
     values ('19000000-0000-0000-0000-000000000102', '19000000-0000-0000-0000-000000000001', '53519000-0000-0000-0000-000000000002', 'A later claim is allowed after cancellation happened') $$,
  'CANCELLED claim permits a later new claim'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53519000-0000-0000-0000-000000000003', true);

insert into public.claims (id, report_id, claimant_id, ownership_evidence_private)
values ('19000000-0000-0000-0000-000000000103', '19000000-0000-0000-0000-000000000001', '53519000-0000-0000-0000-000000000003', 'Other student private evidence for the same found item');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53519000-0000-0000-0000-000000000002', true);

update public.claims
set claim_status = 'CANCELLED'::public.claim_status
where id = '19000000-0000-0000-0000-000000000103';

reset role;

select is(
  (select claim_status::text from public.claims where id = '19000000-0000-0000-0000-000000000103'),
  'PENDING',
  'claimant cannot cancel another user claim'
);

update public.claims
set claim_status = 'APPROVED'::public.claim_status
where id = '19000000-0000-0000-0000-000000000102';

set local role authenticated;
select set_config('request.jwt.claim.sub', '53519000-0000-0000-0000-000000000002', true);

update public.claims
set claim_status = 'CANCELLED'::public.claim_status
where id = '19000000-0000-0000-0000-000000000102';

reset role;

select is(
  (select claim_status::text from public.claims where id = '19000000-0000-0000-0000-000000000102'),
  'APPROVED',
  'claimant cannot cancel a non-PENDING claim'
);

select * from finish();
rollback;
