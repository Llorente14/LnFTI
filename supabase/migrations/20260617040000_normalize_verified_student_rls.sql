create or replace function public.is_verified_profile_status(status_value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(btrim(coalesce(status_value, ''))) = 'verified'
$$;

revoke all on function public.is_verified_profile_status(text) from public, anon, authenticated;

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
      and public.is_verified_profile_status(profiles.verification_status::text)
  )
$$;

revoke all on function public.is_verified_student() from public, anon, authenticated;
grant execute on function public.is_verified_student() to authenticated;

comment on function public.is_verified_profile_status(text) is
  'Canonical case-insensitive check for verified profile status across legacy and production enum casing.';

comment on function public.is_verified_student() is
  'Returns true only for the authenticated student whose profile status canonically equals verified.';
