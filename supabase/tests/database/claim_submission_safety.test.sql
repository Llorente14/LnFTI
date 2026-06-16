begin;
select plan(8);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('53519000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'safetyowner.535240911@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Safetyowner User","nim":"535240911"}'::jsonb, now(), now()),
  ('53519000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'safetyclaimant.535240912@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Safetyclaimant User","nim":"535240912"}'::jsonb, now(), now()),
  ('53519000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'safetyother.535240913@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Safetyother User","nim":"535240913"}'::jsonb, now(), now()),
  ('53519000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'safetyverifier.535240914@stu.untar.ac.id', '', now(), '{}'::jsonb, '{"full_name":"Safetyverifier User","nim":"535240914"}'::jsonb, now(), now());

update public.profiles set role = 'verifier'::public.application_role
where id = '53519000-0000-4000-8000-000000000014';

update public.profiles
set
  verification_status = 'VERIFIED'::public.profile_verification_status,
  verified_at = coalesce(verified_at, now())
where id in (
  '53519000-0000-4000-8000-000000000011',
  '53519000-0000-4000-8000-000000000012',
  '53519000-0000-4000-8000-000000000013'
);

insert into public.reports (
  id, reporter_id, report_type, item_name, category, public_description,
  private_characteristics, building, event_at, report_status, custody_status, published_at
) values
  ('19000000-0000-4000-8000-000000000011', '53519000-0000-4000-8000-000000000011', 'FOUND', 'Handed over pouch', 'Tas', 'A pouch that has already been handed over.', 'Private zipper marking.', 'Gedung R', now(), 'PUBLISHED', 'HANDED_OVER', now()),
  ('19000000-0000-4000-8000-000000000012', '53519000-0000-4000-8000-000000000011', 'FOUND', 'Pending review bottle', 'Botol & Wadah', 'A bottle that has not passed verifier review.', 'Private mark under cap.', 'Gedung M', now(), 'PENDING_REVIEW', 'AT_DPM', null),
  ('19000000-0000-4000-8000-000000000013', '53519000-0000-4000-8000-000000000011', 'FOUND', 'Public blue umbrella', 'Aksesori', 'A public blue umbrella found near the classroom.', 'Private sticker under handle.', 'Gedung L', now(), 'PUBLISHED', 'AT_DPM', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '53519000-0000-4000-8000-000000000012', true);

select throws_ok($$
  insert into public.claims (report_id, claimant_id, ownership_evidence_private)
  values ('19000000-0000-4000-8000-000000000011', '53519000-0000-4000-8000-000000000012', 'This item has already been handed over to a recipient')
$$, null, 'a handed-over report cannot receive a new claim');

select throws_ok($$
  insert into public.claims (report_id, claimant_id, ownership_evidence_private)
  values ('19000000-0000-4000-8000-000000000012', '53519000-0000-4000-8000-000000000012', 'This report has not passed verifier review yet')
$$, null, 'a non-public report cannot receive a claim');

select throws_ok($$
  insert into public.claims (report_id, claimant_id, ownership_evidence_private)
  values ('19000000-0000-4000-8000-000000000013', '53519000-0000-4000-8000-000000000012', 'nineteen chars only')
$$, null, 'evidence below the database minimum is rejected');

select throws_ok($$
  insert into public.claims (report_id, claimant_id, ownership_evidence_private)
  values ('19000000-0000-4000-8000-000000000013', '53519000-0000-4000-8000-000000000012', repeat('x', 2001))
$$, null, 'evidence above the database maximum is rejected');

select throws_ok($$
  insert into public.claims (report_id, claimant_id, ownership_evidence_private)
  values ('19000000-0000-4000-8000-000000000013', '53519000-0000-4000-8000-000000000013', 'Forged claimant identifiers must be rejected by row security')
$$, null, 'a student cannot forge another claimant ID');

select lives_ok($$
  insert into public.claims (report_id, claimant_id, ownership_evidence_private)
  values ('19000000-0000-4000-8000-000000000013', '53519000-0000-4000-8000-000000000012', 'The handle has a small hidden white triangle sticker')
$$, 'a verified student can submit a valid claim');

select is((select claim_status::text from public.claims
  where report_id = '19000000-0000-4000-8000-000000000013'
    and claimant_id = '53519000-0000-4000-8000-000000000012'),
  'PENDING', 'a valid claim defaults to PENDING');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '53519000-0000-4000-8000-000000000014', true);

select throws_ok($$
  insert into public.claims (report_id, claimant_id, ownership_evidence_private)
  values ('19000000-0000-4000-8000-000000000013', '53519000-0000-4000-8000-000000000014', 'Verifier accounts must not submit ownership claims')
$$, null, 'a verifier cannot submit an ownership claim');

reset role;
select * from finish();
rollback;
