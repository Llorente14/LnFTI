-- LNFTI-34 inventory import/export workflow metadata and audited import RPC.

create type public.inventory_import_job_status as enum (
  'PENDING',
  'PARSING',
  'READY',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'EXPIRED'
);

create type public.inventory_import_row_status as enum (
  'VALID',
  'WARNING',
  'ERROR',
  'IMPORTED',
  'SKIPPED',
  'FAILED'
);

create table public.inventory_import_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  original_filename text not null check (length(btrim(original_filename)) > 0),
  workbook_sha256 text not null check (workbook_sha256 ~ '^[a-f0-9]{64}$'),
  source_sheet text not null check (length(btrim(source_sheet)) > 0),
  status public.inventory_import_job_status not null default 'PENDING',
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  warning_rows integer not null default 0 check (warning_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  failed_rows integer not null default 0 check (failed_rows >= 0),
  storage_path text null check (storage_path is null or length(btrim(storage_path)) > 0),
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null
);

alter table public.inventory_import_jobs enable row level security;

create trigger inventory_import_jobs_set_updated_at
before update on public.inventory_import_jobs
for each row execute function public.set_updated_at();

create table public.inventory_import_rows (
  id uuid primary key default extensions.gen_random_uuid(),
  import_job_id uuid not null references public.inventory_import_jobs(id) on delete cascade,
  source_row_number integer not null check (source_row_number > 0),
  raw_values jsonb not null default '{}'::jsonb,
  item_name text not null check (length(btrim(item_name)) > 0),
  category text not null check (length(btrim(category)) > 0),
  campus text not null default 'Kampus 1',
  building text not null default 'Gedung R',
  location_detail text not null,
  event_at timestamptz null,
  public_description text not null check (length(btrim(public_description)) >= 10),
  raw_status text not null check (length(btrim(raw_status)) > 0),
  report_status public.report_status null,
  custody_status public.custody_status null,
  pickup_date timestamptz null,
  item_image_storage_path text null,
  pickup_evidence_storage_path text null,
  item_image_sha256 text null check (item_image_sha256 is null or item_image_sha256 ~ '^[a-f0-9]{64}$'),
  pickup_evidence_sha256 text null check (pickup_evidence_sha256 is null or pickup_evidence_sha256 ~ '^[a-f0-9]{64}$'),
  row_fingerprint text not null check (row_fingerprint ~ '^[a-f0-9]{64}$'),
  planned_report_id uuid not null default extensions.gen_random_uuid(),
  validation_status public.inventory_import_row_status not null,
  validation_messages jsonb not null default '[]'::jsonb,
  report_id uuid null references public.reports(id) on delete set null,
  error_code text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  imported_at timestamptz null,
  unique (import_job_id, row_fingerprint)
);

alter table public.inventory_import_rows enable row level security;

create trigger inventory_import_rows_set_updated_at
before update on public.inventory_import_rows
for each row execute function public.set_updated_at();

create table public.inventory_pickup_evidence (
  id uuid primary key default extensions.gen_random_uuid(),
  import_row_id uuid not null unique references public.inventory_import_rows(id) on delete cascade,
  report_id uuid null references public.reports(id) on delete set null,
  storage_path text not null check (length(btrim(storage_path)) > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

alter table public.inventory_pickup_evidence enable row level security;

create index inventory_import_jobs_requested_by_idx on public.inventory_import_jobs (requested_by);
create index inventory_import_jobs_status_idx on public.inventory_import_jobs (status);
create index inventory_import_jobs_workbook_sha_idx on public.inventory_import_jobs (workbook_sha256);
create index inventory_import_rows_job_idx on public.inventory_import_rows (import_job_id, source_row_number);
create index inventory_import_rows_status_idx on public.inventory_import_rows (validation_status);
create index inventory_import_rows_report_idx on public.inventory_import_rows (report_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'inventory-imports',
  'inventory-imports',
  false,
  41943040,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
), (
  'inventory-exports',
  'inventory-exports',
  false,
  41943040,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

revoke all privileges on table public.inventory_import_jobs from public, anon, authenticated;
revoke all privileges on table public.inventory_import_rows from public, anon, authenticated;
revoke all privileges on table public.inventory_pickup_evidence from public, anon, authenticated;

grant select, insert, update on public.inventory_import_jobs to authenticated;
grant select, insert, update on public.inventory_import_rows to authenticated;
grant select, insert on public.inventory_pickup_evidence to authenticated;
grant insert, update on public.export_jobs to authenticated;
grant insert (id, reporter_id, report_type, item_name, category, public_description, private_characteristics, campus, building, location_detail, event_at, report_status, custody_status, reviewed_by, reviewed_at, published_at, resolved_at)
on public.reports to authenticated;

create policy inventory_import_jobs_verifier_admin
on public.inventory_import_jobs
for all
to authenticated
using (
  public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
)
with check (
  public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
  and requested_by = auth.uid()
);

create policy inventory_import_rows_verifier_admin
on public.inventory_import_rows
for all
to authenticated
using (
  public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
  and exists (
    select 1
    from public.inventory_import_jobs as jobs
    where jobs.id = inventory_import_rows.import_job_id
  )
)
with check (
  public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
  and exists (
    select 1
    from public.inventory_import_jobs as jobs
    where jobs.id = inventory_import_rows.import_job_id
      and jobs.requested_by = auth.uid()
  )
);

create policy inventory_pickup_evidence_verifier_admin
on public.inventory_pickup_evidence
for all
to authenticated
using (
  public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
)
with check (
  public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
);

drop policy if exists export_jobs_manage_verifier_admin
on public.export_jobs;

create policy export_jobs_manage_verifier_admin
on public.export_jobs
for all
to authenticated
using (
  public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
)
with check (
  public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
  and requested_by = auth.uid()
);

create policy storage_inventory_imports_verifier_admin
on storage.objects
for all
to authenticated
using (
  bucket_id = 'inventory-imports'
  and public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
)
with check (
  bucket_id = 'inventory-imports'
  and public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
);

create policy storage_inventory_exports_verifier_admin
on storage.objects
for all
to authenticated
using (
  bucket_id = 'inventory-exports'
  and public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
)
with check (
  bucket_id = 'inventory-exports'
  and public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
);

drop policy if exists storage_report_images_insert_import_verifier_admin
on storage.objects;

create policy storage_report_images_insert_import_verifier_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-images'
  and public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
);

create or replace function public.import_inventory_row(target_row_id uuid)
returns table (
  import_row_id uuid,
  report_id uuid,
  validation_status public.inventory_import_row_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  actor_role public.application_role;
  row_record public.inventory_import_rows%rowtype;
  job_record public.inventory_import_jobs%rowtype;
  next_report_id uuid;
  imported_timestamp timestamptz;
  can_record_failure boolean := false;
begin
  actor_id := auth.uid();

  if actor_id is null then
    raise exception 'authentication required';
  end if;

  actor_role := public.current_app_role();

  if actor_role not in ('verifier'::public.application_role, 'admin'::public.application_role) then
    raise exception 'verifier or admin role required';
  end if;

  select *
  into row_record
  from public.inventory_import_rows as rows
  where rows.id = target_row_id
  for update;

  if not found then
    raise exception 'import row not found';
  end if;

  select *
  into job_record
  from public.inventory_import_jobs as jobs
  where jobs.id = row_record.import_job_id
  for update;

  if not found then
    raise exception 'import job not found';
  end if;

  if job_record.requested_by <> actor_id and actor_role <> 'admin'::public.application_role then
    raise exception 'import job access denied';
  end if;

  can_record_failure := true;

  if row_record.validation_status not in ('VALID'::public.inventory_import_row_status, 'WARNING'::public.inventory_import_row_status, 'FAILED'::public.inventory_import_row_status) then
    raise exception 'row is not importable';
  end if;

  if row_record.event_at is null or row_record.report_status is null or row_record.custody_status is null then
    raise exception 'row has invalid normalized data';
  end if;

  imported_timestamp := pg_catalog.transaction_timestamp();
  next_report_id := coalesce(row_record.report_id, row_record.planned_report_id, extensions.gen_random_uuid());

  insert into public.reports (
    id,
    reporter_id,
    report_type,
    item_name,
    category,
    public_description,
    private_characteristics,
    campus,
    building,
    location_detail,
    event_at,
    report_status,
    custody_status,
    reviewed_by,
    reviewed_at,
    published_at,
    resolved_at
  ) values (
    next_report_id,
    actor_id,
    'FOUND'::public.report_type,
    row_record.item_name,
    row_record.category,
    row_record.public_description,
    null,
    row_record.campus,
    row_record.building,
    row_record.location_detail,
    row_record.event_at,
    row_record.report_status,
    row_record.custody_status,
    actor_id,
    imported_timestamp,
    case
      when row_record.report_status in ('PUBLISHED'::public.report_status, 'RESOLVED'::public.report_status)
        then imported_timestamp
      else null
    end,
    case
      when row_record.report_status = 'RESOLVED'::public.report_status
        then coalesce(row_record.pickup_date, imported_timestamp)
      else null
    end
  );

  if row_record.item_image_storage_path is not null then
    insert into public.report_images (
      report_id,
      storage_path,
      alt_text,
      sort_order
    ) values (
      next_report_id,
      row_record.item_image_storage_path,
      'Foto barang import DPM',
      1
    );
  end if;

  if row_record.pickup_evidence_storage_path is not null and row_record.pickup_evidence_sha256 is not null then
    insert into public.inventory_pickup_evidence (
      import_row_id,
      report_id,
      storage_path,
      sha256
    ) values (
      row_record.id,
      next_report_id,
      row_record.pickup_evidence_storage_path,
      row_record.pickup_evidence_sha256
    )
    on conflict (import_row_id) do nothing;
  end if;

  update public.inventory_import_rows
  set
    validation_status = 'IMPORTED'::public.inventory_import_row_status,
    report_id = next_report_id,
    error_code = null,
    error_message = null,
    imported_at = imported_timestamp
  where id = row_record.id
  returning * into row_record;

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
    'inventory_import_row',
    row_record.id,
    'INVENTORY_ROW_IMPORTED',
    null,
    pg_catalog.jsonb_build_object(
      'validation_status', row_record.validation_status,
      'report_id', next_report_id
    ),
    pg_catalog.jsonb_build_object(
      'job_id', job_record.id,
      'source_row', row_record.source_row_number,
      'report_id', next_report_id,
      'raw_status', row_record.raw_status,
      'mapping_status', row_record.report_status,
      'image_count', case when row_record.item_image_storage_path is null then 0 else 1 end
    )
  );

  update public.inventory_import_jobs
  set
    imported_rows = (
      select count(*)
      from public.inventory_import_rows as rows
      where rows.import_job_id = job_record.id
        and rows.validation_status = 'IMPORTED'::public.inventory_import_row_status
    ),
    failed_rows = (
      select count(*)
      from public.inventory_import_rows as rows
      where rows.import_job_id = job_record.id
        and rows.validation_status = 'FAILED'::public.inventory_import_row_status
    ),
    status = case
      when exists (
        select 1 from public.inventory_import_rows as rows
        where rows.import_job_id = job_record.id
          and rows.validation_status = 'FAILED'::public.inventory_import_row_status
      ) then 'PARTIAL'::public.inventory_import_job_status
      when not exists (
        select 1 from public.inventory_import_rows as rows
        where rows.import_job_id = job_record.id
          and rows.validation_status in ('VALID'::public.inventory_import_row_status, 'WARNING'::public.inventory_import_row_status)
      ) then 'COMPLETED'::public.inventory_import_job_status
      else 'PROCESSING'::public.inventory_import_job_status
    end,
    completed_at = case
      when not exists (
        select 1 from public.inventory_import_rows as rows
        where rows.import_job_id = job_record.id
          and rows.validation_status in ('VALID'::public.inventory_import_row_status, 'WARNING'::public.inventory_import_row_status)
      ) then imported_timestamp
      else completed_at
    end
  where id = job_record.id;

  return query
  select row_record.id, next_report_id, row_record.validation_status;
exception
  when others then
    if not can_record_failure then
      raise;
    end if;

    update public.inventory_import_rows
    set
      validation_status = 'FAILED'::public.inventory_import_row_status,
      error_code = sqlstate,
      error_message = left(sqlerrm, 500)
    where id = target_row_id
    returning * into row_record;

    insert into public.audit_logs (
      actor_id,
      entity_type,
      entity_id,
      action,
      metadata
    ) values (
      actor_id,
      'inventory_import_row',
      target_row_id,
      'INVENTORY_ROW_FAILED',
      pg_catalog.jsonb_build_object(
        'error_code', sqlstate,
        'safe_message', left(sqlerrm, 120)
      )
    );

    update public.inventory_import_jobs
    set
      failed_rows = (
        select count(*)
        from public.inventory_import_rows as rows
        where rows.import_job_id = row_record.import_job_id
          and rows.validation_status = 'FAILED'::public.inventory_import_row_status
      ),
      status = 'PARTIAL'::public.inventory_import_job_status
    where id = row_record.import_job_id;

    return query
    select target_row_id, null::uuid, 'FAILED'::public.inventory_import_row_status;
end;
$$;

revoke all on function public.import_inventory_row(uuid)
from public, anon, authenticated;

grant execute on function public.import_inventory_row(uuid)
to authenticated;

comment on table public.inventory_import_jobs is
  'Tracks verifier/admin Excel inventory import jobs for LNFTI-34.';
comment on table public.inventory_import_rows is
  'Stores parsed legacy inventory rows before audited import into reports.';
comment on table public.inventory_pickup_evidence is
  'Private legacy pickup evidence metadata. Not public report images.';
