alter table public.profiles
alter column verification_status set default 'UNVERIFIED';

update public.profiles
set verification_status = 'UNVERIFIED'
where verification_status = 'PENDING_EMAIL';

create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  identity record;
begin
  select *
  into identity
  from public.resolve_institutional_identity(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'nim',
    new.email
  );

  insert into public.profiles (
    id,
    role,
    display_name,
    nim,
    organization_id,
    nim_prefix,
    program_study_code,
    cohort_year,
    verification_status,
    verified_at
  ) values (
    new.id,
    'student',
    identity.display_name,
    identity.resolved_nim,
    identity.organization_id,
    identity.nim_prefix,
    identity.program_study_code,
    identity.cohort_year,
    'UNVERIFIED',
    null
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;

create or replace function public.on_auth_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;

comment on column public.profiles.verification_status is
  'Trusted business verification status. Email confirmation alone must not mark a profile verified.';

comment on column public.profiles.verified_at is
  'Trusted timestamp for business profile verification, not Supabase Auth email confirmation.';

revoke all on function public.on_auth_user_created() from public, anon, authenticated;
revoke all on function public.on_auth_user_email_confirmed() from public, anon, authenticated;
