create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.application_role as enum (
  'student',
  'verifier',
  'admin'
);

create type public.report_type as enum (
  'LOST',
  'FOUND'
);

create type public.report_status as enum (
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'MATCHING',
  'RESOLVED',
  'REJECTED',
  'CLOSED'
);

create type public.claim_status as enum (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
  'COMPLETED'
);

create type public.custody_status as enum (
  'WITH_FINDER',
  'AT_DPM',
  'HANDED_OVER',
  'UNKNOWN'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.application_role not null default 'student',
  display_name text not null check (length(btrim(display_name)) > 0),
  student_identifier text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create table public.reports (
  id uuid primary key default extensions.gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  report_type public.report_type not null,
  item_name text not null check (length(btrim(item_name)) > 0),
  category text not null check (length(btrim(category)) > 0),
  public_description text not null check (length(btrim(public_description)) >= 10),
  private_characteristics text null check (
    private_characteristics is null
    or length(btrim(private_characteristics)) > 0
  ),
  campus text null,
  building text not null check (length(btrim(building)) > 0),
  location_detail text null,
  event_at timestamptz not null,
  report_status public.report_status not null default 'DRAFT',
  custody_status public.custody_status not null default 'UNKNOWN',
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  rejection_reason text null,
  published_at timestamptz null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create table public.report_images (
  id uuid primary key default extensions.gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  storage_path text not null check (length(btrim(storage_path)) > 0),
  alt_text text null,
  sort_order integer not null check (sort_order between 1 and 3),
  created_at timestamptz not null default now(),
  unique (report_id, sort_order)
);

alter table public.report_images enable row level security;

create table public.claims (
  id uuid primary key default extensions.gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  claimant_id uuid not null references public.profiles(id) on delete restrict,
  ownership_evidence_private text not null check (length(btrim(ownership_evidence_private)) > 0),
  claim_status public.claim_status not null default 'PENDING',
  decided_by uuid null references public.profiles(id) on delete set null,
  decided_at timestamptz null,
  decision_reason text null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, report_id)
);

alter table public.claims enable row level security;

create or replace function public.ensure_handover_claim_ready()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.claims
    where claims.id = new.claim_id
      and claims.report_id = new.report_id
      and claims.claimant_id = new.recipient_id
      and claims.claim_status in ('APPROVED', 'COMPLETED')
  ) then
    raise exception 'handover claim must belong to the report, match the recipient, and be approved or completed';
  end if;

  return new;
end;
$$;

create table public.handovers (
  id uuid primary key default extensions.gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete restrict,
  claim_id uuid not null,
  verifier_id uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  handover_at timestamptz not null default now(),
  handover_location text not null check (length(btrim(handover_location)) > 0),
  notes text null,
  created_at timestamptz not null default now(),
  unique (claim_id),
  unique (report_id),
  foreign key (claim_id, report_id) references public.claims(id, report_id) on delete restrict
);

alter table public.handovers enable row level security;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create trigger claims_set_updated_at
before update on public.claims
for each row execute function public.set_updated_at();

create trigger handovers_ensure_claim_ready
before insert or update of report_id, claim_id, recipient_id on public.handovers
for each row execute function public.ensure_handover_claim_ready();

create unique index claims_one_successful_per_report_idx
on public.claims (report_id)
where claim_status in ('APPROVED', 'COMPLETED');

create index reports_created_at_idx on public.reports (created_at desc);
create index reports_event_at_idx on public.reports (event_at desc);
create index reports_report_type_idx on public.reports (report_type);
create index reports_report_status_idx on public.reports (report_status);
create index reports_custody_status_idx on public.reports (custody_status);
create index reports_category_idx on public.reports (category);
create index reports_building_idx on public.reports (building);
create index reports_reporter_id_idx on public.reports (reporter_id);
create index reports_public_listing_idx
on public.reports (report_type, report_status, event_at desc)
where report_status in ('PUBLISHED', 'MATCHING');

create index report_images_report_id_idx on public.report_images (report_id);

create index claims_report_id_idx on public.claims (report_id);
create index claims_claimant_id_idx on public.claims (claimant_id);
create index claims_claim_status_idx on public.claims (claim_status);
create index claims_created_at_idx on public.claims (created_at desc);

create index handovers_verifier_id_idx on public.handovers (verifier_id);
create index handovers_handover_at_idx on public.handovers (handover_at desc);

comment on table public.profiles is 'Application profile linked one-to-one with Supabase Auth users.';
comment on table public.reports is 'Single lost-and-found report table for LOST and FOUND reports.';

comment on column public.reports.private_characteristics is 'Private item details for ownership verification. Do not expose in default public queries.';
comment on column public.report_images.storage_path is 'Private Storage object path. Store paths, not public URLs.';
comment on column public.claims.ownership_evidence_private is 'Private claimant evidence. Do not expose through public views or default exports.';
