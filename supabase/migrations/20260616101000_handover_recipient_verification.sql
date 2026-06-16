-- LNFTI-21 hardening: a physical handover may only target a currently verified student.
-- This check runs in the existing handover trigger, so direct trusted inserts and the
-- transactional RPC share the same recipient invariant.

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
    join public.profiles as profiles
      on profiles.id = claims.claimant_id
    where claims.id = new.claim_id
      and claims.report_id = new.report_id
      and claims.claimant_id = new.recipient_id
      and claims.claim_status in (
        'APPROVED'::public.claim_status,
        'COMPLETED'::public.claim_status
      )
      and profiles.role = 'student'::public.application_role
      and profiles.verification_status = 'VERIFIED'::public.profile_verification_status
  ) then
    raise exception 'handover claim must belong to the report, match the recipient, and be approved or completed';
  end if;

  return new;
end;
$$;
