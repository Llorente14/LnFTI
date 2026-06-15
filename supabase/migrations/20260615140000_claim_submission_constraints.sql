-- LNFTI-19 ownership claim submission constraints.

alter table public.claims
add constraint claims_ownership_evidence_private_length_check
check (
  pg_catalog.length(pg_catalog.btrim(ownership_evidence_private)) between 20 and 2000
);

create unique index claims_one_active_per_claimant_report_idx
on public.claims (report_id, claimant_id)
where claim_status in (
  'PENDING'::public.claim_status,
  'APPROVED'::public.claim_status,
  'COMPLETED'::public.claim_status
);

create index claims_claimant_created_at_idx
on public.claims (claimant_id, created_at desc);

-- Keep the database as the authoritative claimability boundary. A report that
-- has already been handed over must not accept a new ownership claim even if a
-- stale workflow state leaves it PUBLISHED or MATCHING.
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
        and reports.custody_status <> 'HANDED_OVER'::public.custody_status
        and reports.reporter_id <> auth.uid()
    )
$$;

revoke all on function public.can_claim_report(uuid)
from public, anon, authenticated;

grant execute on function public.can_claim_report(uuid)
to authenticated;
