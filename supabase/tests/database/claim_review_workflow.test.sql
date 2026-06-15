begin;

select plan(24);

select has_function(
  'public',
  'review_claim',
  array['uuid', 'public.claim_review_decision', 'text'],
  'review_claim RPC exists'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('53520000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ownerclaimreview.535240921@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Ownerclaimreview User","nim":"535240921"}'::jsonb, now(), now()),
  ('53520000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'claimantone.535240922@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Claimantone User","nim":"535240922"}'::jsonb, now(), now()),
  ('53520000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'claimanttwo.535240923@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Claimanttwo User","nim":"535240923"}'::jsonb, now(), now()),
  ('53520000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'claimantthree.535240924@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Claimantthree User","nim":"535240924"}'::jsonb, now(), now()),
  ('53520000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'verifierclaims.535240925@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Verifierclaims User","nim":"535240925"}'::jsonb, now(), now());

update public.profiles
set role = 'verifier'::public.application_role
where id = '53520000-0000-0000-0000-000000000005';

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
  ('20000000-0000-0000-0000-000000000001', '53520000-0000-0000-0000-000000000001', 'FOUND', 'Blue tumbler', 'Botol & Wadah', 'Blue tumbler found near the classroom door', 'Hidden sticker under cap', 'Gedung R', now(), 'PUBLISHED', 'AT_DPM', now()),
  ('20000000-0000-0000-0000-000000000002', '53520000-0000-0000-0000-000000000001', 'FOUND', 'Silver charger', 'Elektronik', 'Silver charger found beside the lab table', 'Cable has private label', 'Gedung L', now(), 'PUBLISHED', 'UNKNOWN', now());

insert into public.claims (id, report_id, claimant_id, ownership_evidence_private)
values
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '53520000-0000-0000-0000-000000000002', 'The cap underside has a small white triangle sticker'),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '53520000-0000-0000-0000-000000000003', 'The bottle has a tiny scratch near the bottom ring'),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '53520000-0000-0000-0000-000000000002', 'The charger cable has a private initials label'),
  ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', '53520000-0000-0000-0000-000000000003', 'The adapter has a small marker dot near the plug');

set local role anon;

select throws_ok(
  $$ select * from public.review_claim('21000000-0000-0000-0000-000000000001', 'APPROVE'::public.claim_review_decision, 'Valid proof') $$,
  '42501',
  null,
  'anonymous decision is denied'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53520000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$ select * from public.review_claim('21000000-0000-0000-0000-000000000001', 'APPROVE'::public.claim_review_decision, 'Valid proof') $$,
  null,
  'student decision is denied'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53520000-0000-0000-0000-000000000005', true);

select lives_ok(
  $$ select * from public.review_claim('21000000-0000-0000-0000-000000000001', 'APPROVE'::public.claim_review_decision, 'Private evidence matches') $$,
  'verifier can approve a PENDING claim'
);

select is(
  (select claim_status::text from public.claims where id = '21000000-0000-0000-0000-000000000001'),
  'APPROVED',
  'approved claim becomes APPROVED'
);

select is(
  (select decided_by from public.claims where id = '21000000-0000-0000-0000-000000000001'),
  '53520000-0000-0000-0000-000000000005'::uuid,
  'decided_by equals verifier'
);

select isnt(
  (select decided_at from public.claims where id = '21000000-0000-0000-0000-000000000001'),
  null,
  'decided_at is populated'
);

select is(
  (select decision_reason from public.claims where id = '21000000-0000-0000-0000-000000000001'),
  'Private evidence matches',
  'approval reason is stored'
);

select is(
  (select report_status::text from public.reports where id = '20000000-0000-0000-0000-000000000001'),
  'MATCHING',
  'report becomes MATCHING'
);

select is(
  (select custody_status::text from public.reports where id = '20000000-0000-0000-0000-000000000001'),
  'AT_DPM',
  'report custody remains unchanged'
);

select is(
  (select count(*)::integer from public.audit_logs where entity_id = '21000000-0000-0000-0000-000000000001' and action = 'CLAIM_APPROVED'),
  1,
  'exactly one CLAIM_APPROVED audit event exists'
);

select is(
  (select count(*)::integer from public.audit_logs where entity_id = '20000000-0000-0000-0000-000000000001' and action = 'REPORT_MATCHING_STARTED'),
  1,
  'one REPORT_MATCHING_STARTED audit event exists'
);

select is(
  (select claim_status::text from public.claims where id = '21000000-0000-0000-0000-000000000002'),
  'REJECTED',
  'competing PENDING claims become REJECTED'
);

select is(
  (select count(*)::integer from public.audit_logs where entity_id = '21000000-0000-0000-0000-000000000002' and action = 'CLAIM_AUTO_REJECTED'),
  1,
  'competing claim has CLAIM_AUTO_REJECTED audit event'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53520000-0000-0000-0000-000000000004', true);

select throws_ok(
  $$ insert into public.claims (report_id, claimant_id, ownership_evidence_private)
     values ('20000000-0000-0000-0000-000000000001', '53520000-0000-0000-0000-000000000004', 'New claim after matching should not be accepted') $$,
  null,
  'a new claim cannot be submitted after report becomes MATCHING'
);

reset role;

select throws_ok(
  $$ insert into public.claims (report_id, claimant_id, ownership_evidence_private, claim_status)
     values ('20000000-0000-0000-0000-000000000001', '53520000-0000-0000-0000-000000000004', 'Another approved claim should violate uniqueness', 'APPROVED') $$,
  null,
  'another APPROVED claim cannot be created'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '53520000-0000-0000-0000-000000000005', true);

select lives_ok(
  $$ select * from public.review_claim('21000000-0000-0000-0000-000000000003', 'REJECT'::public.claim_review_decision, 'Evidence does not match') $$,
  'verifier can reject a separate PENDING claim'
);

select is(
  (select decision_reason from public.claims where id = '21000000-0000-0000-0000-000000000003'),
  'Evidence does not match',
  'rejected claim stores the reason'
);

select is(
  (select report_status::text from public.reports where id = '20000000-0000-0000-0000-000000000002'),
  'PUBLISHED',
  'rejected report remains PUBLISHED'
);

select is(
  (select claim_status::text from public.claims where id = '21000000-0000-0000-0000-000000000004'),
  'PENDING',
  'rejection does not modify other pending claims'
);

select throws_ok(
  $$ select * from public.review_claim('21000000-0000-0000-0000-000000000003', 'REJECT'::public.claim_review_decision, 'Second decision') $$,
  null,
  'repeated decision is rejected'
);

select throws_ok(
  $$ select * from public.review_claim('21000000-0000-0000-0000-000000000004', 'REJECT'::public.claim_review_decision, 'no') $$,
  null,
  'short reason is rejected'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53520000-0000-0000-0000-000000000001', true);

select is(
  (select count(*)::integer from public.claims where id = '21000000-0000-0000-0000-000000000001'),
  0,
  'reporter cannot read ownership evidence'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53520000-0000-0000-0000-000000000002', true);

select is(
  (select ownership_evidence_private from public.claims where id = '21000000-0000-0000-0000-000000000001'),
  'The cap underside has a small white triangle sticker',
  'claimant retains permitted evidence access'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53520000-0000-0000-0000-000000000005', true);

select is(
  (select count(*)::integer from public.claims where id = '21000000-0000-0000-0000-000000000001'),
  1,
  'verifier/admin retains permitted evidence access'
);

reset role;

select * from finish();
rollback;
