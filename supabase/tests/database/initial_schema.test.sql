begin;

select plan(83);

select has_type('public', 'application_role', 'application_role enum exists');
select set_eq(
  $$
    select enumlabel::text
    from pg_enum
    where enumtypid = 'public.application_role'::regtype
  $$,
  $$ values ('student'), ('verifier'), ('admin') $$,
  'application_role has required labels'
);

select has_type('public', 'report_type', 'report_type enum exists');
select set_eq(
  $$
    select enumlabel::text
    from pg_enum
    where enumtypid = 'public.report_type'::regtype
  $$,
  $$ values ('LOST'), ('FOUND') $$,
  'report_type has required labels'
);

select has_type('public', 'report_status', 'report_status enum exists');
select set_eq(
  $$
    select enumlabel::text
    from pg_enum
    where enumtypid = 'public.report_status'::regtype
  $$,
  $$
    values
      ('DRAFT'),
      ('PENDING_REVIEW'),
      ('PUBLISHED'),
      ('MATCHING'),
      ('RESOLVED'),
      ('REJECTED'),
      ('CLOSED')
  $$,
  'report_status has required labels'
);

select has_type('public', 'claim_status', 'claim_status enum exists');
select set_eq(
  $$
    select enumlabel::text
    from pg_enum
    where enumtypid = 'public.claim_status'::regtype
  $$,
  $$
    values
      ('PENDING'),
      ('APPROVED'),
      ('REJECTED'),
      ('EXPIRED'),
      ('CANCELLED'),
      ('COMPLETED')
  $$,
  'claim_status has required labels'
);

select has_type('public', 'custody_status', 'custody_status enum exists');
select set_eq(
  $$
    select enumlabel::text
    from pg_enum
    where enumtypid = 'public.custody_status'::regtype
  $$,
  $$
    values
      ('WITH_FINDER'),
      ('AT_DPM'),
      ('HANDED_OVER'),
      ('UNKNOWN')
  $$,
  'custody_status has required labels'
);

select has_type('public', 'export_job_status', 'export_job_status enum exists');
select set_eq(
  $$
    select enumlabel::text
    from pg_enum
    where enumtypid = 'public.export_job_status'::regtype
  $$,
  $$
    values
      ('PENDING'),
      ('PROCESSING'),
      ('COMPLETED'),
      ('FAILED'),
      ('EXPIRED')
  $$,
  'export_job_status has required labels'
);

select has_type('public', 'export_format', 'export_format enum exists');
select set_eq(
  $$
    select enumlabel::text
    from pg_enum
    where enumtypid = 'public.export_format'::regtype
  $$,
  $$ values ('XLSX'), ('CSV') $$,
  'export_format has required labels'
);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'reports', 'reports table exists');
select has_table('public', 'report_images', 'report_images table exists');
select has_table('public', 'claims', 'claims table exists');
select has_table('public', 'handovers', 'handovers table exists');
select has_table('public', 'audit_logs', 'audit_logs table exists');
select has_table('public', 'export_jobs', 'export_jobs table exists');

select fk_ok('public', 'profiles', 'id', 'auth', 'users', 'id', 'profiles references auth.users');
select fk_ok('public', 'reports', 'reporter_id', 'public', 'profiles', 'id', 'reports reporter_id references profiles');
select fk_ok('public', 'reports', 'reviewed_by', 'public', 'profiles', 'id', 'reports reviewed_by references profiles');
select fk_ok('public', 'report_images', 'report_id', 'public', 'reports', 'id', 'report_images references reports');
select fk_ok('public', 'claims', 'report_id', 'public', 'reports', 'id', 'claims report_id references reports');
select fk_ok('public', 'claims', 'claimant_id', 'public', 'profiles', 'id', 'claims claimant_id references profiles');
select fk_ok('public', 'claims', 'decided_by', 'public', 'profiles', 'id', 'claims decided_by references profiles');
select fk_ok('public', 'handovers', 'report_id', 'public', 'reports', 'id', 'handovers report_id references reports');
select ok(
  exists (
    select 1
    from pg_constraint constraint_info
    join pg_attribute handover_claim_id
      on handover_claim_id.attrelid = constraint_info.conrelid
      and handover_claim_id.attnum = constraint_info.conkey[1]
      and handover_claim_id.attname = 'claim_id'
    join pg_attribute handover_report_id
      on handover_report_id.attrelid = constraint_info.conrelid
      and handover_report_id.attnum = constraint_info.conkey[2]
      and handover_report_id.attname = 'report_id'
    join pg_attribute claim_id
      on claim_id.attrelid = constraint_info.confrelid
      and claim_id.attnum = constraint_info.confkey[1]
      and claim_id.attname = 'id'
    join pg_attribute claim_report_id
      on claim_report_id.attrelid = constraint_info.confrelid
      and claim_report_id.attnum = constraint_info.confkey[2]
      and claim_report_id.attname = 'report_id'
    where constraint_info.conrelid = 'public.handovers'::regclass
      and constraint_info.confrelid = 'public.claims'::regclass
      and constraint_info.contype = 'f'
  ),
  'handovers has composite claim/report foreign key'
);
select fk_ok('public', 'handovers', 'verifier_id', 'public', 'profiles', 'id', 'handovers verifier_id references profiles');
select fk_ok('public', 'handovers', 'recipient_id', 'public', 'profiles', 'id', 'handovers recipient_id references profiles');
select fk_ok('public', 'audit_logs', 'actor_id', 'public', 'profiles', 'id', 'audit_logs actor_id references profiles');
select fk_ok('public', 'export_jobs', 'requested_by', 'public', 'profiles', 'id', 'export_jobs requested_by references profiles');

select set_eq(
  $$
    select relname::text
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where nspname = 'public'
      and relname in (
        'profiles',
        'reports',
        'report_images',
        'claims',
        'handovers',
        'audit_logs',
        'export_jobs'
      )
      and relrowsecurity
  $$,
  $$
    values
      ('profiles'),
      ('reports'),
      ('report_images'),
      ('claims'),
      ('handovers'),
      ('audit_logs'),
      ('export_jobs')
  $$,
  'RLS is enabled on all application tables'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'reports',
        'report_images',
        'claims',
        'handovers',
        'audit_logs',
        'export_jobs'
      )
  ),
  0,
  'no application RLS policies exist yet'
);

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
    '00000000-0000-0000-0000-000000000101',
    'authenticated',
    'authenticated',
    'student1@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'authenticated',
    'authenticated',
    'student2@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    'authenticated',
    'authenticated',
    'verifier@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, role, display_name, student_identifier) values
  ('00000000-0000-0000-0000-000000000101', 'student', 'Student One', 'NIM001'),
  ('00000000-0000-0000-0000-000000000102', 'student', 'Student Two', 'NIM002'),
  ('00000000-0000-0000-0000-000000000103', 'verifier', 'Verifier One', null);

select lives_ok(
  $$
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
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000101',
      'LOST',
      'Wallet',
      'Accessories',
      'Black wallet lost near the lobby',
      'Hidden initials inside the wallet',
      'Gedung R',
      now(),
      'PUBLISHED',
      'WITH_FINDER'
    )
  $$,
  'LOST report can be inserted'
);

select lives_ok(
  $$
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
    ) values (
      '10000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000102',
      'FOUND',
      'Umbrella',
      'Personal item',
      'Blue umbrella found near classroom',
      'Small sticker under the handle',
      'Gedung M',
      now(),
      'PUBLISHED',
      'AT_DPM'
    )
  $$,
  'FOUND report can be inserted'
);

select is(
  (
    select public_description
    from public.reports
    where id = '10000000-0000-0000-0000-000000000001'
  ),
  'Black wallet lost near the lobby',
  'public description is stored separately'
);

select is(
  (
    select private_characteristics
    from public.reports
    where id = '10000000-0000-0000-0000-000000000001'
  ),
  'Hidden initials inside the wallet',
  'private characteristics are stored separately'
);

select throws_ok(
  $$
    insert into public.reports (
      reporter_id,
      report_type,
      item_name,
      category,
      public_description,
      building,
      event_at
    ) values (
      '00000000-0000-0000-0000-000000000101',
      'INVALID',
      'Phone',
      'Electronics',
      'Invalid enum report attempt',
      'Gedung R',
      now()
    )
  $$,
  '22P02',
  null,
  'invalid report_type enum value is rejected'
);

select throws_ok(
  $$
    insert into public.reports (
      reporter_id,
      report_type,
      item_name,
      category,
      public_description,
      building,
      event_at,
      report_status
    ) values (
      '00000000-0000-0000-0000-000000000101',
      'LOST',
      'Phone',
      'Electronics',
      'Invalid status attempt',
      'Gedung R',
      now(),
      'INVALID'
    )
  $$,
  '22P02',
  null,
  'invalid report_status enum value is rejected'
);

select lives_ok(
  $$
    insert into public.claims (
      id,
      report_id,
      claimant_id,
      ownership_evidence_private,
      claim_status
    ) values (
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000101',
      'I can describe the sticker',
      'APPROVED'
    )
  $$,
  'first approved claim can be inserted'
);

insert into public.claims (
  id,
  report_id,
  claimant_id,
  ownership_evidence_private,
  claim_status
) values
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000102',
    'Pending claim evidence',
    'PENDING'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000102',
    'Rejected claim evidence',
    'REJECTED'
  );

select throws_ok(
  $$
    insert into public.claims (
      id,
      report_id,
      claimant_id,
      ownership_evidence_private,
      claim_status
    ) values (
      '20000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000102',
      'I also claim this item',
      'APPROVED'
    )
  $$,
  '23505',
  null,
  'more than one approved claim for one report is rejected'
);

select throws_ok(
  $$
    insert into public.handovers (
      report_id,
      claim_id,
      verifier_id,
      recipient_id,
      handover_location
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000103',
      '00000000-0000-0000-0000-000000000101',
      'DPM Office'
    )
  $$,
  'P0001',
  'handover claim must belong to the report and be approved or completed',
  'mismatched report and claim are rejected'
);

select throws_ok(
  $$
    insert into public.handovers (
      report_id,
      claim_id,
      verifier_id,
      recipient_id,
      handover_location
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000103',
      '00000000-0000-0000-0000-000000000102',
      'DPM Office'
    )
  $$,
  'P0001',
  'handover claim must belong to the report and be approved or completed',
  'PENDING claims cannot be handed over'
);

select throws_ok(
  $$
    insert into public.handovers (
      report_id,
      claim_id,
      verifier_id,
      recipient_id,
      handover_location
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000103',
      '00000000-0000-0000-0000-000000000102',
      'DPM Office'
    )
  $$,
  'P0001',
  'handover claim must belong to the report and be approved or completed',
  'REJECTED claims cannot be handed over'
);

select lives_ok(
  $$
    insert into public.handovers (
      report_id,
      claim_id,
      verifier_id,
      recipient_id,
      handover_location
    ) values (
      '10000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000103',
      '00000000-0000-0000-0000-000000000101',
      'DPM Office'
    )
  $$,
  'an APPROVED claim handover succeeds'
);

select throws_ok(
  $$
    insert into public.handovers (
      report_id,
      claim_id,
      verifier_id,
      recipient_id,
      handover_location
    ) values (
      '10000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000103',
      '00000000-0000-0000-0000-000000000101',
      'DPM Office'
    )
  $$,
  '23505',
  null,
  'a second handover for the same claim is rejected'
);

select lives_ok(
  $$
    insert into public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      '00000000-0000-0000-0000-000000000103',
      'test.audit.inserted',
      'report',
      '10000000-0000-0000-0000-000000000001',
      '{"safe": true}'::jsonb
    )
  $$,
  'audit_logs accepts insert'
);

select throws_ok(
  $$ update public.audit_logs set metadata = '{"changed": true}'::jsonb where id = 1 $$,
  'P0001',
  'audit_logs is append-only',
  'audit_logs rejects update'
);

select throws_ok(
  $$ delete from public.audit_logs where id = 1 $$,
  'P0001',
  'audit_logs is append-only',
  'audit_logs rejects delete'
);

insert into public.export_jobs (
  id,
  requested_by,
  export_format,
  dataset
) values (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000103',
  'CSV',
  'reports'
);

select is(
  (select include_sensitive from public.export_jobs where id = '30000000-0000-0000-0000-000000000001'),
  false,
  'include_sensitive defaults to false'
);

select throws_ok(
  $$
    insert into public.export_jobs (
      requested_by,
      export_format,
      dataset,
      include_sensitive
    ) values (
      '00000000-0000-0000-0000-000000000103',
      'XLSX',
      'audit_logs',
      true
    )
  $$,
  '23514',
  null,
  'include_sensitive true without a reason is rejected'
);

select pg_sleep(0.01);

update public.profiles
set display_name = 'Student One Updated'
where id = '00000000-0000-0000-0000-000000000101';

select ok(
  (
    select updated_at > created_at
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000101'
  ),
  'updated_at changes when an eligible row is updated'
);

select has_index('public', 'claims', 'claims_one_approved_per_report_idx', 'approved claim partial unique index exists');
select has_index('public', 'claims', 'claims_id_report_id_key', 'claims id and report_id unique key backs handover integrity');
select has_index('public', 'reports', 'reports_created_at_idx', 'reports created_at index exists');
select has_index('public', 'reports', 'reports_event_at_idx', 'reports event_at index exists');
select has_index('public', 'reports', 'reports_report_type_idx', 'reports report_type index exists');
select has_index('public', 'reports', 'reports_report_status_idx', 'reports report_status index exists');
select has_index('public', 'reports', 'reports_custody_status_idx', 'reports custody_status index exists');
select has_index('public', 'reports', 'reports_category_idx', 'reports category index exists');
select has_index('public', 'reports', 'reports_building_idx', 'reports building index exists');
select has_index('public', 'reports', 'reports_reporter_id_idx', 'reports reporter_id index exists');
select has_index('public', 'reports', 'reports_public_listing_idx', 'reports public listing composite index exists');
select has_index('public', 'report_images', 'report_images_report_id_idx', 'report_images report_id index exists');
select has_index('public', 'claims', 'claims_report_id_idx', 'claims report_id index exists');
select has_index('public', 'claims', 'claims_claimant_id_idx', 'claims claimant_id index exists');
select has_index('public', 'claims', 'claims_claim_status_idx', 'claims claim_status index exists');
select has_index('public', 'claims', 'claims_created_at_idx', 'claims created_at index exists');
select has_index('public', 'handovers', 'handovers_report_id_idx', 'handovers report_id index exists');
select has_index('public', 'handovers', 'handovers_claim_id_key', 'handovers claim_id unique index covers claim_id');
select has_index('public', 'handovers', 'handovers_verifier_id_idx', 'handovers verifier_id index exists');
select has_index('public', 'handovers', 'handovers_handover_at_idx', 'handovers handover_at index exists');
select has_index('public', 'audit_logs', 'audit_logs_created_at_idx', 'audit_logs created_at index exists');
select has_index('public', 'audit_logs', 'audit_logs_actor_id_idx', 'audit_logs actor_id index exists');
select has_index('public', 'audit_logs', 'audit_logs_entity_idx', 'audit_logs entity index exists');
select has_index('public', 'audit_logs', 'audit_logs_action_idx', 'audit_logs action index exists');
select has_index('public', 'export_jobs', 'export_jobs_requested_by_idx', 'export_jobs requested_by index exists');
select has_index('public', 'export_jobs', 'export_jobs_status_idx', 'export_jobs status index exists');
select has_index('public', 'export_jobs', 'export_jobs_created_at_idx', 'export_jobs created_at index exists');
select has_index('public', 'export_jobs', 'export_jobs_expires_at_idx', 'export_jobs expires_at index exists');

select * from finish();

rollback;
