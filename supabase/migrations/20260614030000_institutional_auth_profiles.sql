create type public.profile_verification_status as enum (
  'PENDING_EMAIL',
  'VERIFIED'
);

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  student_email_domain text not null check (length(btrim(student_email_domain)) > 0),
  created_at timestamptz not null default now(),
  unique (student_email_domain)
);

alter table public.organizations enable row level security;

create table public.nim_prefixes (
  prefix text primary key check (prefix ~ '^[0-9]{3}$'),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  program_study_code text not null check (length(btrim(program_study_code)) > 0),
  program_study_name text not null check (length(btrim(program_study_name)) > 0),
  allowed_cohorts smallint[] not null check (cardinality(allowed_cohorts) > 0),
  created_at timestamptz not null default now(),
  unique (organization_id, program_study_code),
  unique (prefix, organization_id, program_study_code)
);

alter table public.nim_prefixes enable row level security;

insert into public.organizations (id, code, name, student_email_domain)
values (
  '40000000-0000-0000-0000-000000000001',
  'UNTAR_FTI',
  'Fakultas Teknologi Informasi Universitas Tarumanagara',
  'stu.untar.ac.id'
);

insert into public.nim_prefixes (
  prefix,
  organization_id,
  program_study_code,
  program_study_name,
  allowed_cohorts
) values
  (
    '535',
    '40000000-0000-0000-0000-000000000001',
    'TI',
    'Teknik Informatika',
    array[24, 25]::smallint[]
  ),
  (
    '825',
    '40000000-0000-0000-0000-000000000001',
    'SI',
    'Sistem Informasi',
    array[24, 25]::smallint[]
  );

alter table public.profiles
rename column student_identifier to nim;

alter table public.profiles
add column organization_id uuid null references public.organizations(id) on delete restrict,
add column nim_prefix text null,
add column program_study_code text null,
add column cohort_year smallint null check (cohort_year is null or cohort_year in (2024, 2025)),
add column verification_status public.profile_verification_status not null default 'PENDING_EMAIL',
add column verified_at timestamptz null,
add constraint profiles_nim_format_check check (nim is null or nim ~ '^[0-9]{9}$'),
add constraint profiles_student_institutional_fields_check check (
  role <> 'student'
  or (
    nim is not null
    and organization_id is not null
    and nim_prefix is not null
    and program_study_code is not null
    and cohort_year is not null
  )
),
add constraint profiles_nim_prefix_matches_check check (
  nim is null
  or nim_prefix is null
  or nim_prefix = substring(nim from 1 for 3)
),
add constraint profiles_nim_cohort_matches_check check (
  nim is null
  or cohort_year is null
  or cohort_year = 2000 + substring(nim from 4 for 2)::smallint
),
add constraint profiles_program_mapping_fk foreign key (
  nim_prefix,
  organization_id,
  program_study_code
) references public.nim_prefixes (
  prefix,
  organization_id,
  program_study_code
) on delete restrict;

create unique index profiles_nim_key
on public.profiles (nim)
where nim is not null;

comment on column public.profiles.nim is 'Trusted immutable student NIM derived and validated by auth database triggers.';
comment on column public.profiles.organization_id is 'Trusted organization reference derived from NIM prefix and institutional email domain.';
comment on column public.profiles.nim_prefix is 'Trusted NIM prefix derived from NIM; browser metadata is ignored.';
comment on column public.profiles.program_study_code is 'Trusted program code derived from database reference data.';
comment on column public.profiles.cohort_year is 'Trusted cohort year derived from NIM cohort code.';
comment on column public.profiles.verification_status is 'Trusted profile verification status maintained by auth triggers, not browser metadata.';
comment on column public.profiles.verified_at is 'Trusted timestamp set when Supabase Auth confirms institutional email.';

create or replace function public.normalize_auth_first_name(full_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  first_token text;
  normalized text;
begin
  if full_name is null or length(btrim(full_name)) = 0 then
    raise exception 'full_name is required';
  end if;

  first_token := (regexp_split_to_array(btrim(full_name), '\s+'))[1];
  normalized := regexp_replace(lower(first_token), '[^a-z]', '', 'g');

  if normalized = '' then
    raise exception 'full_name must start with letters a-z';
  end if;

  return normalized;
end;
$$;

create or replace function public.resolve_institutional_identity(
  full_name text,
  nim text,
  email text
)
returns table (
  display_name text,
  normalized_first_name text,
  resolved_nim text,
  organization_id uuid,
  nim_prefix text,
  program_study_code text,
  program_study_name text,
  cohort_code smallint,
  cohort_year smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  trimmed_name text;
  normalized_email text;
  local_part text;
  domain_part text;
  local_parts text[];
begin
  trimmed_name := btrim(full_name);

  if trimmed_name is null or length(trimmed_name) = 0 then
    raise exception 'full_name is required';
  end if;

  if nim is null or nim !~ '^[0-9]{9}$' then
    raise exception 'NIM must be exactly 9 digits';
  end if;

  if email is null or email <> btrim(email) then
    raise exception 'email must not contain surrounding whitespace';
  end if;

  normalized_email := lower(email);

  if array_length(regexp_split_to_array(normalized_email, '@'), 1) <> 2 then
    raise exception 'email must contain one at sign';
  end if;

  local_part := split_part(normalized_email, '@', 1);
  domain_part := split_part(normalized_email, '@', 2);
  local_parts := regexp_split_to_array(local_part, '\.');

  if array_length(local_parts, 1) <> 2 then
    raise exception 'email local part must be first-name.NIM';
  end if;

  if local_parts[1] <> public.normalize_auth_first_name(trimmed_name) then
    raise exception 'email first-name token does not match full_name';
  end if;

  if local_parts[2] <> nim then
    raise exception 'email NIM token does not match metadata NIM';
  end if;

  return query
  select
    trimmed_name,
    public.normalize_auth_first_name(trimmed_name),
    nim,
    organizations.id,
    nim_prefixes.prefix,
    nim_prefixes.program_study_code,
    nim_prefixes.program_study_name,
    substring(nim from 4 for 2)::smallint,
    (2000 + substring(nim from 4 for 2)::smallint)::smallint
  from public.nim_prefixes
  join public.organizations
    on organizations.id = nim_prefixes.organization_id
  where nim_prefixes.prefix = substring(nim from 1 for 3)
    and substring(nim from 4 for 2)::smallint = any(nim_prefixes.allowed_cohorts)
    and organizations.student_email_domain = domain_part;

  if not found then
    raise exception 'institutional identity is not allowed';
  end if;
end;
$$;

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
    case when new.email_confirmed_at is null then 'PENDING_EMAIL'::public.profile_verification_status else 'VERIFIED'::public.profile_verification_status end,
    case when new.email_confirmed_at is null then null else new.email_confirmed_at end
  );

  return new;
end;
$$;

create or replace function public.on_auth_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
    set
      verification_status = 'VERIFIED',
      verified_at = new.email_confirmed_at
    where id = new.id;
  end if;

  return new;
end;
$$;

create or replace function public.protect_institutional_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.profiles%rowtype;
  identity record;
begin
  if new.email is not distinct from old.email then
    return new;
  end if;

  select *
  into profile_row
  from public.profiles
  where id = new.id;

  if not found or profile_row.nim is null then
    return new;
  end if;

  select *
  into identity
  from public.resolve_institutional_identity(
    profile_row.display_name,
    profile_row.nim,
    new.email
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.on_auth_user_created();

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
after update of email_confirmed_at on auth.users
for each row execute function public.on_auth_user_email_confirmed();

drop trigger if exists protect_institutional_email_change on auth.users;
create trigger protect_institutional_email_change
before update of email on auth.users
for each row execute function public.protect_institutional_email_change();

revoke all on function public.normalize_auth_first_name(text) from public, anon, authenticated;
revoke all on function public.resolve_institutional_identity(text, text, text) from public, anon, authenticated;
revoke all on function public.on_auth_user_created() from public, anon, authenticated;
revoke all on function public.on_auth_user_email_confirmed() from public, anon, authenticated;
revoke all on function public.protect_institutional_email_change() from public, anon, authenticated;

grant select on public.profiles to authenticated;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());
