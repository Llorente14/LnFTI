-- LNFTI-20 audited verifier ownership claim review workflow.
-- Lock order for claim review and future handover work:
-- 1. read claim.report_id, 2. lock report row, 3. lock all report claims by id,
-- 4. revalidate selected claim/report after locks.

create type public.claim_review_decision as enum (
  'APPROVE',
  'REJECT'
);

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
        and reports.report_status = 'PUBLISHED'::public.report_status
        and reports.custody_status <> 'HANDED_OVER'::public.custody_status
        and reports.reporter_id <> auth.uid()
        and not exists (
          select 1
          from public.claims as claims
          where claims.report_id = reports.id
            and claims.claim_status in (
              'APPROVED'::public.claim_status,
              'COMPLETED'::public.claim_status
            )
        )
    )
$$;

create or replace function public.review_claim(
  target_claim_id uuid,
  decision public.claim_review_decision,
  reason text
)
returns table (
  claim_id uuid,
  claim_status public.claim_status,
  report_id uuid,
  report_status public.report_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  actor_role public.application_role;
  normalized_reason text;
  decision_timestamp timestamptz;
  target_report_id uuid;
  claim_row public.claims%rowtype;
  report_row public.reports%rowtype;
  claimant_row public.profiles%rowtype;
  claim_before jsonb;
  claim_after jsonb;
  report_before jsonb;
  report_after jsonb;
  competing_claim record;
  competing_before jsonb;
  competing_after jsonb;
begin
  actor_id := auth.uid();

  if actor_id is null then
    raise exception 'authentication required';
  end if;

  actor_role := public.current_app_role();

  if actor_role not in ('verifier'::public.application_role, 'admin'::public.application_role) then
    raise exception 'verifier or admin role required';
  end if;

  if target_claim_id is null then
    raise exception 'target_claim_id is required';
  end if;

  if decision is null then
    raise exception 'decision is required';
  end if;

  normalized_reason := pg_catalog.btrim(coalesce(reason, ''));

  if pg_catalog.length(normalized_reason) < 5 or pg_catalog.length(normalized_reason) > 500 then
    raise exception 'reason must be between 5 and 500 characters';
  end if;

  select claims.report_id
  into target_report_id
  from public.claims as claims
  where claims.id = target_claim_id;

  if target_report_id is null then
    raise exception 'claim not found';
  end if;

  select *
  into report_row
  from public.reports as reports
  where reports.id = target_report_id
  for update;

  if not found then
    raise exception 'report not found';
  end if;

  perform 1
  from public.claims as claims
  where claims.report_id = target_report_id
  order by claims.id
  for update;

  select *
  into claim_row
  from public.claims as claims
  where claims.id = target_claim_id;

  if not found then
    raise exception 'claim not found';
  end if;

  select *
  into claimant_row
  from public.profiles as profiles
  where profiles.id = claim_row.claimant_id;

  if not found
    or claimant_row.role <> 'student'::public.application_role
    or claimant_row.verification_status <> 'VERIFIED'::public.profile_verification_status
  then
    raise exception 'claimant must be a verified student';
  end if;

  if claim_row.claim_status <> 'PENDING'::public.claim_status then
    raise exception 'claim must be pending review';
  end if;

  if report_row.report_type <> 'FOUND'::public.report_type then
    raise exception 'report must be a found report';
  end if;

  if report_row.report_status <> 'PUBLISHED'::public.report_status then
    raise exception 'report must be published';
  end if;

  if report_row.custody_status = 'HANDED_OVER'::public.custody_status then
    raise exception 'report has already been handed over';
  end if;

  if report_row.reporter_id = claim_row.claimant_id then
    raise exception 'claimant cannot be report owner';
  end if;

  claim_before := pg_catalog.jsonb_build_object(
    'claim_status', claim_row.claim_status,
    'decided_by', claim_row.decided_by,
    'decided_at', claim_row.decided_at,
    'decision_reason', claim_row.decision_reason,
    'expires_at', claim_row.expires_at
  );

  decision_timestamp := pg_catalog.transaction_timestamp();

  if decision = 'APPROVE'::public.claim_review_decision then
    if exists (
      select 1
      from public.claims as claims
      where claims.report_id = report_row.id
        and claims.id <> claim_row.id
        and claims.claim_status in (
          'APPROVED'::public.claim_status,
          'COMPLETED'::public.claim_status
        )
    ) then
      raise exception 'another claim is already successful';
    end if;

    update public.claims
    set
      claim_status = 'APPROVED'::public.claim_status,
      decided_by = actor_id,
      decided_at = decision_timestamp,
      decision_reason = normalized_reason
    where claims.id = claim_row.id
    returning * into claim_row;

    claim_after := pg_catalog.jsonb_build_object(
      'claim_status', claim_row.claim_status,
      'decided_by', claim_row.decided_by,
      'decided_at', claim_row.decided_at,
      'decision_reason', claim_row.decision_reason,
      'expires_at', claim_row.expires_at
    );

    insert into public.audit_logs (
      actor_id,
      entity_type,
      entity_id,
      action,
      before_data,
      after_data,
      metadata
    ) values (
      actor_id,
      'claim',
      claim_row.id,
      'CLAIM_APPROVED',
      claim_before,
      claim_after,
      pg_catalog.jsonb_build_object(
        'decision', decision,
        'reason', normalized_reason,
        'report_id', report_row.id,
        'report_type', report_row.report_type,
        'source', 'verifier_claim_dashboard',
        'automatic', false
      )
    );

    for competing_claim in
      select *
      from public.claims as claims
      where claims.report_id = report_row.id
        and claims.id <> claim_row.id
        and claims.claim_status = 'PENDING'::public.claim_status
      order by claims.id
    loop
      competing_before := pg_catalog.jsonb_build_object(
        'claim_status', competing_claim.claim_status,
        'decided_by', competing_claim.decided_by,
        'decided_at', competing_claim.decided_at,
        'decision_reason', competing_claim.decision_reason,
        'expires_at', competing_claim.expires_at
      );

      update public.claims
      set
        claim_status = 'REJECTED'::public.claim_status,
        decided_by = actor_id,
        decided_at = decision_timestamp,
        decision_reason = 'Klaim lain telah disetujui untuk laporan ini.'
      where claims.id = competing_claim.id
      returning * into competing_claim;

      competing_after := pg_catalog.jsonb_build_object(
        'claim_status', competing_claim.claim_status,
        'decided_by', competing_claim.decided_by,
        'decided_at', competing_claim.decided_at,
        'decision_reason', competing_claim.decision_reason,
        'expires_at', competing_claim.expires_at
      );

      insert into public.audit_logs (
        actor_id,
        entity_type,
        entity_id,
        action,
        before_data,
        after_data,
        metadata
      ) values (
        actor_id,
        'claim',
        competing_claim.id,
        'CLAIM_AUTO_REJECTED',
        competing_before,
        competing_after,
        pg_catalog.jsonb_build_object(
          'decision', 'REJECT',
          'reason', 'Klaim lain telah disetujui untuk laporan ini.',
          'report_id', report_row.id,
          'report_type', report_row.report_type,
          'source', 'verifier_claim_dashboard',
          'automatic', true
        )
      );
    end loop;

    report_before := pg_catalog.jsonb_build_object(
      'report_status', report_row.report_status,
      'custody_status', report_row.custody_status
    );

    update public.reports
    set report_status = 'MATCHING'::public.report_status
    where reports.id = report_row.id
    returning * into report_row;

    report_after := pg_catalog.jsonb_build_object(
      'report_status', report_row.report_status,
      'custody_status', report_row.custody_status
    );

    insert into public.audit_logs (
      actor_id,
      entity_type,
      entity_id,
      action,
      before_data,
      after_data,
      metadata
    ) values (
      actor_id,
      'report',
      report_row.id,
      'REPORT_MATCHING_STARTED',
      report_before,
      report_after,
      pg_catalog.jsonb_build_object(
        'approved_claim_id', claim_row.id,
        'decision', decision,
        'source', 'verifier_claim_dashboard'
      )
    );
  elsif decision = 'REJECT'::public.claim_review_decision then
    update public.claims
    set
      claim_status = 'REJECTED'::public.claim_status,
      decided_by = actor_id,
      decided_at = decision_timestamp,
      decision_reason = normalized_reason
    where claims.id = claim_row.id
    returning * into claim_row;

    claim_after := pg_catalog.jsonb_build_object(
      'claim_status', claim_row.claim_status,
      'decided_by', claim_row.decided_by,
      'decided_at', claim_row.decided_at,
      'decision_reason', claim_row.decision_reason,
      'expires_at', claim_row.expires_at
    );

    insert into public.audit_logs (
      actor_id,
      entity_type,
      entity_id,
      action,
      before_data,
      after_data,
      metadata
    ) values (
      actor_id,
      'claim',
      claim_row.id,
      'CLAIM_REJECTED',
      claim_before,
      claim_after,
      pg_catalog.jsonb_build_object(
        'decision', decision,
        'reason', normalized_reason,
        'report_id', report_row.id,
        'report_type', report_row.report_type,
        'source', 'verifier_claim_dashboard',
        'automatic', false
      )
    );
  else
    raise exception 'unsupported claim review decision';
  end if;

  return query
  select claim_row.id, claim_row.claim_status, report_row.id, report_row.report_status;
end;
$$;

revoke all on function public.can_claim_report(uuid)
from public, anon, authenticated;
revoke all on function public.review_claim(uuid, public.claim_review_decision, text)
from public, anon, authenticated;

grant execute on function public.can_claim_report(uuid) to authenticated;
grant execute on function public.review_claim(uuid, public.claim_review_decision, text) to authenticated;
