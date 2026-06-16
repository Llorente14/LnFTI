-- LNFTI-21 transactional physical handover workflow.
-- Lock order matches public.review_claim():
-- 1. read claim.report_id, 2. lock report row, 3. lock all report claims by id,
-- 4. check existing handovers, 5. revalidate selected claim/report, 6. mutate.

alter table public.handovers
  add constraint handovers_location_length_check
  check (
    pg_catalog.length(pg_catalog.btrim(handover_location)) between 3 and 200
  );

alter table public.handovers
  add constraint handovers_notes_length_check
  check (
    notes is null
    or pg_catalog.length(pg_catalog.btrim(notes)) between 1 and 1000
  );

create or replace function public.ensure_handover_claim_ready()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.report_id is null
    or new.claim_id is null
    or new.recipient_id is null
  then
    raise exception 'handover claim relationship is required';
  end if;

  if not exists (
    select 1
    from public.claims as claims
    where claims.id = new.claim_id
      and claims.report_id = new.report_id
      and claims.claimant_id = new.recipient_id
      and claims.claim_status in (
        'APPROVED'::public.claim_status,
        'COMPLETED'::public.claim_status
      )
  ) then
    raise exception 'handover claim must belong to the report, match the recipient, and be approved or completed';
  end if;

  return new;
end;
$$;

create or replace function public.set_report_custody_status(
  target_report_id uuid,
  new_custody_status public.custody_status,
  reason text
)
returns table (
  report_id uuid,
  custody_status public.custody_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  actor_role public.application_role;
  normalized_reason text;
  before_workflow jsonb;
  after_workflow jsonb;
  report_row public.reports%rowtype;
  old_custody_status public.custody_status;
begin
  actor_id := auth.uid();

  if actor_id is null then
    raise exception 'authentication required';
  end if;

  actor_role := public.current_app_role();

  if actor_role not in ('verifier'::public.application_role, 'admin'::public.application_role) then
    raise exception 'verifier or admin role required';
  end if;

  if target_report_id is null then
    raise exception 'target_report_id is required';
  end if;

  if new_custody_status is null then
    raise exception 'new_custody_status is required';
  end if;

  normalized_reason := pg_catalog.btrim(coalesce(reason, ''));

  if pg_catalog.length(normalized_reason) < 5 or pg_catalog.length(normalized_reason) > 500 then
    raise exception 'reason must be between 5 and 500 characters';
  end if;

  select *
  into report_row
  from public.reports as reports
  where reports.id = target_report_id
  for update;

  if not found then
    raise exception 'report not found';
  end if;

  if new_custody_status = 'HANDED_OVER'::public.custody_status
    or report_row.custody_status = 'HANDED_OVER'::public.custody_status
    or report_row.report_status in (
      'RESOLVED'::public.report_status,
      'CLOSED'::public.report_status
    )
  then
    raise exception 'handed over custody requires transactional handover';
  end if;

  if report_row.report_status = 'DRAFT'::public.report_status then
    raise exception 'draft reports cannot change custody';
  end if;

  old_custody_status := report_row.custody_status;

  if old_custody_status = new_custody_status then
    raise exception 'custody status is unchanged';
  end if;

  before_workflow := pg_catalog.jsonb_build_object(
    'report_status', report_row.report_status,
    'custody_status', report_row.custody_status
  );

  update public.reports
  set custody_status = new_custody_status
  where reports.id = target_report_id
  returning * into report_row;

  after_workflow := pg_catalog.jsonb_build_object(
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
    target_report_id,
    'REPORT_CUSTODY_CHANGED',
    before_workflow,
    after_workflow,
    pg_catalog.jsonb_build_object(
      'reason', normalized_reason,
      'old_custody_status', old_custody_status,
      'new_custody_status', new_custody_status,
      'report_type', report_row.report_type
    )
  );

  return query
  select report_row.id, report_row.custody_status;
end;
$$;

create or replace function public.complete_handover(
  target_claim_id uuid,
  handover_location text,
  notes text default null
)
returns table (
  handover_id uuid,
  claim_id uuid,
  claim_status public.claim_status,
  report_id uuid,
  report_status public.report_status,
  custody_status public.custody_status,
  handover_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  actor_role public.application_role;
  normalized_location text;
  normalized_notes text;
  handover_timestamp timestamptz;
  target_report_id uuid;
  claim_row public.claims%rowtype;
  report_row public.reports%rowtype;
  claimant_row public.profiles%rowtype;
  handover_row public.handovers%rowtype;
  claim_before jsonb;
  claim_after jsonb;
  report_before jsonb;
  report_after jsonb;
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

  normalized_location := pg_catalog.btrim(coalesce(handover_location, ''));

  if pg_catalog.length(normalized_location) < 3
    or pg_catalog.length(normalized_location) > 200
  then
    raise exception 'handover_location must be between 3 and 200 characters';
  end if;

  normalized_notes := nullif(pg_catalog.btrim(coalesce(notes, '')), '');

  if normalized_notes is not null and pg_catalog.length(normalized_notes) > 1000 then
    raise exception 'notes must be at most 1000 characters';
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

  perform claims.id
  from public.claims as claims
  where claims.report_id = target_report_id
  order by claims.id
  for update;

  if exists (
    select 1
    from public.handovers as handovers
    where handovers.report_id = target_report_id
       or handovers.claim_id = target_claim_id
  ) then
    raise exception 'handover already completed';
  end if;

  select *
  into claim_row
  from public.claims as claims
  where claims.id = target_claim_id;

  if not found or claim_row.report_id <> report_row.id then
    raise exception 'claim/report mismatch';
  end if;

  select *
  into claimant_row
  from public.profiles as profiles
  where profiles.id = claim_row.claimant_id;

  if not found then
    raise exception 'claimant profile not found';
  end if;

  if claim_row.claim_status <> 'APPROVED'::public.claim_status then
    raise exception 'claim must be approved for handover';
  end if;

  if report_row.report_type <> 'FOUND'::public.report_type then
    raise exception 'report must be a found report';
  end if;

  if report_row.report_status <> 'MATCHING'::public.report_status then
    raise exception 'report must be matching';
  end if;

  if report_row.custody_status not in (
    'UNKNOWN'::public.custody_status,
    'WITH_FINDER'::public.custody_status,
    'AT_DPM'::public.custody_status
  ) then
    raise exception 'report has already been handed over';
  end if;

  if report_row.resolved_at is not null then
    raise exception 'report is already resolved';
  end if;

  if report_row.reporter_id = claim_row.claimant_id then
    raise exception 'claimant cannot be report owner';
  end if;

  handover_timestamp := pg_catalog.transaction_timestamp();

  claim_before := pg_catalog.jsonb_build_object(
    'claim_status', claim_row.claim_status,
    'decided_by', claim_row.decided_by,
    'decided_at', claim_row.decided_at,
    'decision_reason', claim_row.decision_reason,
    'expires_at', claim_row.expires_at
  );

  report_before := pg_catalog.jsonb_build_object(
    'report_status', report_row.report_status,
    'custody_status', report_row.custody_status,
    'resolved_at', report_row.resolved_at
  );

  insert into public.handovers (
    report_id,
    claim_id,
    verifier_id,
    recipient_id,
    handover_at,
    handover_location,
    notes
  ) values (
    report_row.id,
    claim_row.id,
    actor_id,
    claim_row.claimant_id,
    handover_timestamp,
    normalized_location,
    normalized_notes
  )
  returning * into handover_row;

  update public.claims
  set claim_status = 'COMPLETED'::public.claim_status
  where claims.id = claim_row.id
    and claims.claim_status = 'APPROVED'::public.claim_status
  returning * into claim_row;

  if not found then
    raise exception 'claim must be approved for handover';
  end if;

  claim_after := pg_catalog.jsonb_build_object(
    'claim_status', claim_row.claim_status,
    'decided_by', claim_row.decided_by,
    'decided_at', claim_row.decided_at,
    'decision_reason', claim_row.decision_reason,
    'expires_at', claim_row.expires_at
  );

  update public.reports
  set
    report_status = 'RESOLVED'::public.report_status,
    custody_status = 'HANDED_OVER'::public.custody_status,
    resolved_at = handover_timestamp
  where reports.id = report_row.id
    and reports.report_status = 'MATCHING'::public.report_status
    and reports.custody_status in (
      'UNKNOWN'::public.custody_status,
      'WITH_FINDER'::public.custody_status,
      'AT_DPM'::public.custody_status
    )
    and reports.resolved_at is null
  returning * into report_row;

  if not found then
    raise exception 'report must be matching and unresolved';
  end if;

  report_after := pg_catalog.jsonb_build_object(
    'report_status', report_row.report_status,
    'custody_status', report_row.custody_status,
    'resolved_at', report_row.resolved_at
  );

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    actor_id,
    'HANDOVER_COMPLETED',
    'handover',
    handover_row.id,
    '{}'::jsonb,
    pg_catalog.jsonb_build_object(
      'report_id', handover_row.report_id,
      'claim_id', handover_row.claim_id,
      'verifier_id', handover_row.verifier_id,
      'recipient_id', handover_row.recipient_id,
      'handover_at', handover_row.handover_at,
      'handover_location', handover_row.handover_location
    ),
    pg_catalog.jsonb_build_object(
      'source', 'verifier_handover_dashboard'
    )
  );

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    actor_id,
    'CLAIM_COMPLETED',
    'claim',
    claim_row.id,
    claim_before,
    claim_after,
    pg_catalog.jsonb_build_object(
      'report_id', report_row.id,
      'handover_id', handover_row.id,
      'source', 'verifier_handover_dashboard'
    )
  );

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    actor_id,
    'REPORT_RESOLVED_BY_HANDOVER',
    'report',
    report_row.id,
    report_before,
    report_after,
    pg_catalog.jsonb_build_object(
      'claim_id', claim_row.id,
      'handover_id', handover_row.id,
      'source', 'verifier_handover_dashboard'
    )
  );

  return query
  select
    handover_row.id,
    claim_row.id,
    claim_row.claim_status,
    report_row.id,
    report_row.report_status,
    report_row.custody_status,
    handover_row.handover_at;
end;
$$;

revoke all on function public.set_report_custody_status(uuid, public.custody_status, text)
from public, anon, authenticated;
revoke all on function public.complete_handover(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.set_report_custody_status(uuid, public.custody_status, text)
to authenticated;
grant execute on function public.complete_handover(uuid, text, text)
to authenticated;
