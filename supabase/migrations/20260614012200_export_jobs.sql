create type public.export_job_status as enum (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'EXPIRED'
);

create type public.export_format as enum (
  'XLSX',
  'CSV'
);

create table public.export_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  export_format public.export_format not null,
  dataset text not null check (length(btrim(dataset)) > 0),
  filter_snapshot jsonb not null default '{}'::jsonb,
  include_sensitive boolean not null default false,
  sensitive_export_reason text null,
  status public.export_job_status not null default 'PENDING',
  row_count integer null check (row_count is null or row_count >= 0),
  storage_path text null check (storage_path is null or length(btrim(storage_path)) > 0),
  error_message text null,
  expires_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    include_sensitive = false
    or length(btrim(coalesce(sensitive_export_reason, ''))) > 0
  )
);

alter table public.export_jobs enable row level security;

create trigger export_jobs_set_updated_at
before update on public.export_jobs
for each row execute function public.set_updated_at();

create index export_jobs_requested_by_idx on public.export_jobs (requested_by);
create index export_jobs_status_idx on public.export_jobs (status);
create index export_jobs_created_at_idx on public.export_jobs (created_at desc);
create index export_jobs_expires_at_idx on public.export_jobs (expires_at);

comment on table public.export_jobs is 'Tracks verifier/admin audit export requests. File generation is implemented in a later ticket.';
comment on column public.export_jobs.include_sensitive is 'Defaults false. Sensitive exports require an explicit reason and later permission checks.';
comment on column public.export_jobs.storage_path is 'Temporary export file Storage path. Do not store public URLs.';
