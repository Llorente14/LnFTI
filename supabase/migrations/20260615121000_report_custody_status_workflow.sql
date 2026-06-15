-- LNFTI-18 audited verifier custody status workflow.

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

revoke all on function public.set_report_custody_status(uuid, public.custody_status, text)
from public, anon, authenticated;

grant execute on function public.set_report_custody_status(uuid, public.custody_status, text)
to authenticated;
