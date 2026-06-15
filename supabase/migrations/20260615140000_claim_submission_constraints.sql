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
