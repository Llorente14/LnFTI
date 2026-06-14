-- LNFTI-14 role-based access control.
--
-- Anonymous users browse only the safe public_reports view.
-- Students access their own private rows and may create/edit only allowed fields.
-- Verifier/admin roles can read records required for verification.
-- Workflow decisions and handover mutations remain audited RPC work in later tickets.

create or replace function public.current_app_role()
returns public.application_role
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.role
  from public.profiles as profiles
  where profiles.id = auth.uid()
$$;

create or replace function public.is_verified_student()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profiles
    where profiles.id = auth.uid()
      and profiles.role = 'student'::public.application_role
      and profiles.verification_status = 'VERIFIED'::public.profile_verification_status
  )
$$;

create or replace function public.can_claim_report(target_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_verified_student()
    and exists (
      select 1
      from public.reports as reports
      where reports.id = target_report_id
        and reports.report_type = 'FOUND'::public.report_type
        and reports.report_status in (
          'PUBLISHED'::public.report_status,
          'MATCHING'::public.report_status
        )
        and reports.reporter_id <> auth.uid()
    )
$$;

revoke all on function public.current_app_role() from public, anon, authenticated;
revoke all on function public.is_verified_student() from public, anon, authenticated;
revoke all on function public.can_claim_report(uuid) from public, anon, authenticated;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_verified_student() to authenticated;
grant execute on function public.can_claim_report(uuid) to authenticated;

revoke all privileges on table public.organizations from public, anon, authenticated;
revoke all privileges on table public.nim_prefixes from public, anon, authenticated;
revoke all privileges on table public.profiles from public, anon, authenticated;
revoke all privileges on table public.reports from public, anon, authenticated;
revoke all privileges on table public.report_images from public, anon, authenticated;
revoke all privileges on table public.claims from public, anon, authenticated;
revoke all privileges on table public.handovers from public, anon, authenticated;
revoke all privileges on table public.audit_logs from public, anon, authenticated;
revoke all privileges on table public.export_jobs from public, anon, authenticated;

-- Profiles: students retain the LNFTI-13 own-row policy; privileged roles read all.
grant select on public.profiles to authenticated;

create policy profiles_select_verifier_admin
on public.profiles
for select
to authenticated
using (
  public.current_app_role() in (
    'verifier'::public.application_role,
    'admin'::public.application_role
  )
);

-- Reports: public browsing goes through a safe view; base rows remain private.
grant select, delete on public.reports to authenticated;
grant insert (
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
  report_status
) on public.reports to authenticated;
grant update (
  report_type,
  item_name,
  category,
  public_description,
  private_characteristics,
  campus,
  building,
  location_detail,
  event_at,
  report_status
) on public.reports to authenticated;

create policy reports_select_own_or_verifier_admin
on public.reports
for select
to authenticated
using (
  reporter_id = auth.uid()
  or public.current_app_role() in (
    'verifier'::public.application_role,
    'admin'::public.application_role
  )
);

create policy reports_insert_own_draft_or_pending
on public.reports
for insert
to authenticated
with check (
  public.is_verified_student()
  and reporter_id = auth.uid()
  and report_status in (
    'DRAFT'::public.report_status,
    'PENDING_REVIEW'::public.report_status
  )
);

create policy reports_update_own_editable
on public.reports
for update
to authenticated
using (
  public.is_verified_student()
  and reporter_id = auth.uid()
  and report_status in (
    'DRAFT'::public.report_status,
    'PENDING_REVIEW'::public.report_status
  )
)
with check (
  public.is_verified_student()
  and reporter_id = auth.uid()
  and report_status in (
    'DRAFT'::public.report_status,
    'PENDING_REVIEW'::public.report_status
  )
);

create policy reports_delete_own_draft
on public.reports
for delete
to authenticated
using (
  public.is_verified_student()
  and reporter_id = auth.uid()
  and report_status = 'DRAFT'::public.report_status
);

create view public.public_reports
with (security_barrier = true)
as
select
  reports.id,
  reports.report_type,
  reports.item_name,
  reports.category,
  reports.public_description,
  reports.campus,
  reports.building,
  reports.event_at,
  reports.report_status,
  reports.custody_status,
  reports.published_at,
  reports.created_at
from public.reports as reports
where reports.report_status in (
  'PUBLISHED'::public.report_status,
  'MATCHING'::public.report_status
);

revoke all privileges on public.public_reports from public, anon, authenticated;
grant select on public.public_reports to anon, authenticated;

comment on view public.public_reports is
  'Safe anonymous report listing. Excludes reporter identifiers, private characteristics, review fields, and exact location details.';

-- Image metadata: object access itself is handled by LNFTI-15 Storage policies.
grant select, delete on public.report_images to authenticated;
grant insert (report_id, storage_path, alt_text, sort_order)
on public.report_images to authenticated;

create policy report_images_select_own_or_verifier_admin
on public.report_images
for select
to authenticated
using (
  public.current_app_role() in (
    'verifier'::public.application_role,
    'admin'::public.application_role
  )
  or exists (
    select 1
    from public.reports as reports
    where reports.id = report_images.report_id
      and reports.reporter_id = auth.uid()
  )
);

create policy report_images_insert_own_editable_report
on public.report_images
for insert
to authenticated
with check (
  public.is_verified_student()
  and exists (
    select 1
    from public.reports as reports
    where reports.id = report_images.report_id
      and reports.reporter_id = auth.uid()
      and reports.report_status in (
        'DRAFT'::public.report_status,
        'PENDING_REVIEW'::public.report_status
      )
  )
);

create policy report_images_delete_own_editable_report
on public.report_images
for delete
to authenticated
using (
  public.is_verified_student()
  and exists (
    select 1
    from public.reports as reports
    where reports.id = report_images.report_id
      and reports.reporter_id = auth.uid()
      and reports.report_status in (
        'DRAFT'::public.report_status,
        'PENDING_REVIEW'::public.report_status
      )
  )
);

-- Claims: students can create pending claims and cancel their own pending claim.
grant select on public.claims to authenticated;
grant insert (report_id, claimant_id, ownership_evidence_private)
on public.claims to authenticated;
grant update (claim_status) on public.claims to authenticated;

create policy claims_select_own_or_verifier_admin
on public.claims
for select
to authenticated
using (
  claimant_id = auth.uid()
  or public.current_app_role() in (
    'verifier'::public.application_role,
    'admin'::public.application_role
  )
);

create policy claims_insert_own_for_claimable_report
on public.claims
for insert
to authenticated
with check (
  claimant_id = auth.uid()
  and claim_status = 'PENDING'::public.claim_status
  and public.can_claim_report(report_id)
);

create policy claims_cancel_own_pending
on public.claims
for update
to authenticated
using (
  public.is_verified_student()
  and claimant_id = auth.uid()
  and claim_status = 'PENDING'::public.claim_status
)
with check (
  public.is_verified_student()
  and claimant_id = auth.uid()
  and claim_status = 'CANCELLED'::public.claim_status
);

-- Handover, audit, and export records are read-only through direct table access.
grant select on public.handovers to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.export_jobs to authenticated;

create policy handovers_select_recipient_or_verifier_admin
on public.handovers
for select
to authenticated
using (
  recipient_id = auth.uid()
  or public.current_app_role() in (
    'verifier'::public.application_role,
    'admin'::public.application_role
  )
);

create policy audit_logs_select_verifier_admin
on public.audit_logs
for select
to authenticated
using (
  public.current_app_role() in (
    'verifier'::public.application_role,
    'admin'::public.application_role
  )
);

create policy export_jobs_select_verifier_admin
on public.export_jobs
for select
to authenticated
using (
  public.current_app_role() in (
    'verifier'::public.application_role,
    'admin'::public.application_role
  )
);
