-- LNFTI-18 audited verifier report review workflow.

create type public.report_review_decision as enum (
  'APPROVE',
  'REJECT'
);

create or replace function public.review_report(
  target_report_id uuid,
  decision public.report_review_decision,
  reason text
)
returns table (
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
  before_workflow jsonb;
  after_workflow jsonb;
  report_row public.reports%rowtype;
  new_status public.report_status;
  action_name text;
  reviewed_timestamp timestamptz;
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

  if decision is null then
    raise exception 'decision is required';
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

  if report_row.report_status <> 'PENDING_REVIEW'::public.report_status then
    raise exception 'report must be pending review';
  end if;

  before_workflow := pg_catalog.jsonb_build_object(
    'report_status', report_row.report_status,
    'custody_status', report_row.custody_status,
    'reviewed_by', report_row.reviewed_by,
    'reviewed_at', report_row.reviewed_at,
    'rejection_reason', report_row.rejection_reason,
    'published_at', report_row.published_at
  );

  reviewed_timestamp := pg_catalog.transaction_timestamp();

  if decision = 'APPROVE'::public.report_review_decision then
    new_status := 'PUBLISHED'::public.report_status;
    action_name := 'REPORT_REVIEW_APPROVED';

    update public.reports
    set
      report_status = new_status,
      reviewed_by = actor_id,
      reviewed_at = reviewed_timestamp,
      rejection_reason = null,
      published_at = reviewed_timestamp
    where reports.id = target_report_id
    returning * into report_row;
  elsif decision = 'REJECT'::public.report_review_decision then
    new_status := 'REJECTED'::public.report_status;
    action_name := 'REPORT_REVIEW_REJECTED';

    update public.reports
    set
      report_status = new_status,
      reviewed_by = actor_id,
      reviewed_at = reviewed_timestamp,
      rejection_reason = normalized_reason,
      published_at = null
    where reports.id = target_report_id
    returning * into report_row;
  else
    raise exception 'unsupported review decision';
  end if;

  after_workflow := pg_catalog.jsonb_build_object(
    'report_status', report_row.report_status,
    'custody_status', report_row.custody_status,
    'reviewed_by', report_row.reviewed_by,
    'reviewed_at', report_row.reviewed_at,
    'rejection_reason', report_row.rejection_reason,
    'published_at', report_row.published_at
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
    action_name,
    before_workflow,
    after_workflow,
    pg_catalog.jsonb_build_object(
      'reason', normalized_reason,
      'decision', decision,
      'report_type', report_row.report_type,
      'source', 'verifier_dashboard'
    )
  );

  return query
  select report_row.id, report_row.report_status;
end;
$$;

revoke all on function public.review_report(uuid, public.report_review_decision, text)
from public, anon, authenticated;

grant execute on function public.review_report(uuid, public.report_review_decision, text)
to authenticated;
