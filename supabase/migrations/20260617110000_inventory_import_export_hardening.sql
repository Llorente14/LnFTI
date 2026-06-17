-- LNFTI-34 review hardening for inventory import/export.

alter table public.inventory_import_jobs
add column if not exists retry_of_job_id uuid null references public.inventory_import_jobs(id) on delete set null;

drop policy if exists inventory_import_jobs_verifier_admin on public.inventory_import_jobs;
drop policy if exists inventory_import_jobs_select_owner_admin on public.inventory_import_jobs;
drop policy if exists inventory_import_jobs_insert_owner on public.inventory_import_jobs;
drop policy if exists inventory_import_jobs_update_owner_admin on public.inventory_import_jobs;

create policy inventory_import_jobs_select_owner_admin
on public.inventory_import_jobs
for select
to authenticated
using (
  public.current_app_role() = 'admin'::public.application_role
  or (
    public.current_app_role() = 'verifier'::public.application_role
    and requested_by = auth.uid()
  )
);

create policy inventory_import_jobs_insert_owner
on public.inventory_import_jobs
for insert
to authenticated
with check (
  public.current_app_role() = 'admin'::public.application_role
  or (
    requested_by = auth.uid()
    and public.current_app_role() = 'verifier'::public.application_role
  )
);

create policy inventory_import_jobs_update_owner_admin
on public.inventory_import_jobs
for update
to authenticated
using (
  public.current_app_role() = 'admin'::public.application_role
  or (
    public.current_app_role() = 'verifier'::public.application_role
    and requested_by = auth.uid()
  )
)
with check (
  public.current_app_role() = 'admin'::public.application_role
  or (
    requested_by = auth.uid()
    and public.current_app_role() = 'verifier'::public.application_role
  )
);

drop policy if exists inventory_import_rows_verifier_admin on public.inventory_import_rows;
drop policy if exists inventory_import_rows_owner_admin on public.inventory_import_rows;

create policy inventory_import_rows_owner_admin
on public.inventory_import_rows
for all
to authenticated
using (
  exists (
    select 1
    from public.inventory_import_jobs as jobs
    where jobs.id = inventory_import_rows.import_job_id
      and (
        jobs.requested_by = auth.uid()
        or public.current_app_role() = 'admin'::public.application_role
      )
  )
)
with check (
  exists (
    select 1
    from public.inventory_import_jobs as jobs
    where jobs.id = inventory_import_rows.import_job_id
      and (
        jobs.requested_by = auth.uid()
        or public.current_app_role() = 'admin'::public.application_role
      )
  )
);

drop policy if exists inventory_pickup_evidence_verifier_admin on public.inventory_pickup_evidence;
drop policy if exists inventory_pickup_evidence_owner_admin on public.inventory_pickup_evidence;

create policy inventory_pickup_evidence_owner_admin
on public.inventory_pickup_evidence
for all
to authenticated
using (
  public.current_app_role() = 'admin'::public.application_role
  or exists (
    select 1
    from public.inventory_import_rows as rows
    join public.inventory_import_jobs as jobs
      on jobs.id = rows.import_job_id
    where rows.id = inventory_pickup_evidence.import_row_id
      and jobs.requested_by = auth.uid()
  )
)
with check (
  public.current_app_role() = 'admin'::public.application_role
  or exists (
    select 1
    from public.inventory_import_rows as rows
    join public.inventory_import_jobs as jobs
      on jobs.id = rows.import_job_id
    where rows.id = inventory_pickup_evidence.import_row_id
      and jobs.requested_by = auth.uid()
  )
);

drop policy if exists export_jobs_select_verifier_admin on public.export_jobs;
drop policy if exists export_jobs_manage_verifier_admin on public.export_jobs;
drop policy if exists export_jobs_select_owner_admin on public.export_jobs;
drop policy if exists export_jobs_insert_owner on public.export_jobs;
drop policy if exists export_jobs_update_owner_admin on public.export_jobs;

create policy export_jobs_select_owner_admin
on public.export_jobs
for select
to authenticated
using (
  public.current_app_role() = 'admin'::public.application_role
  or (
    public.current_app_role() = 'verifier'::public.application_role
    and requested_by = auth.uid()
  )
);

create policy export_jobs_insert_owner
on public.export_jobs
for insert
to authenticated
with check (
  requested_by = auth.uid()
  and public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
);

create policy export_jobs_update_owner_admin
on public.export_jobs
for update
to authenticated
using (
  public.current_app_role() = 'admin'::public.application_role
  or (
    public.current_app_role() = 'verifier'::public.application_role
    and requested_by = auth.uid()
  )
)
with check (
  requested_by = auth.uid()
  and public.current_app_role() in ('verifier'::public.application_role, 'admin'::public.application_role)
);

drop policy if exists storage_inventory_imports_verifier_admin on storage.objects;
drop policy if exists storage_inventory_exports_verifier_admin on storage.objects;
drop policy if exists storage_inventory_imports_owner_admin on storage.objects;
drop policy if exists storage_inventory_exports_owner_admin on storage.objects;

create policy storage_inventory_imports_owner_admin
on storage.objects
for all
to authenticated
using (
  bucket_id = 'inventory-imports'
  and (
    public.current_app_role() = 'admin'::public.application_role
    or (storage.foldername(name))[1] = auth.uid()::text
  )
)
with check (
  bucket_id = 'inventory-imports'
  and (
    public.current_app_role() = 'admin'::public.application_role
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy storage_inventory_exports_owner_admin
on storage.objects
for all
to authenticated
using (
  bucket_id = 'inventory-exports'
  and (
    public.current_app_role() = 'admin'::public.application_role
    or (storage.foldername(name))[1] = auth.uid()::text
  )
)
with check (
  bucket_id = 'inventory-exports'
  and (
    public.current_app_role() = 'admin'::public.application_role
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create or replace function public.log_inventory_audit(
  event_action text,
  event_entity_type text,
  event_entity_id uuid,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.application_role;
begin
  actor_role := public.current_app_role();

  if auth.uid() is null or actor_role not in ('verifier'::public.application_role, 'admin'::public.application_role) then
    raise exception 'verifier or admin role required';
  end if;

  insert into public.audit_logs (
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  ) values (
    auth.uid(),
    event_entity_type,
    event_entity_id,
    event_action,
    coalesce(event_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_inventory_audit(text, text, uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.log_inventory_audit(text, text, uuid, jsonb)
to authenticated;

create or replace function public.update_inventory_import_row(
  target_row_id uuid,
  next_item_name text,
  next_category text,
  next_location_detail text,
  next_event_at timestamptz,
  next_public_description text,
  next_raw_status text,
  next_report_status public.report_status,
  next_custody_status public.custody_status,
  next_pickup_date timestamptz,
  next_row_fingerprint text,
  next_validation_status public.inventory_import_row_status,
  next_validation_messages jsonb
)
returns public.inventory_import_rows
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  actor_role public.application_role;
  row_record public.inventory_import_rows%rowtype;
  job_record public.inventory_import_jobs%rowtype;
begin
  actor_id := auth.uid();
  actor_role := public.current_app_role();

  if actor_id is null or actor_role not in ('verifier'::public.application_role, 'admin'::public.application_role) then
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

  if job_record.requested_by <> actor_id and actor_role <> 'admin'::public.application_role then
    raise exception 'import job access denied';
  end if;

  if row_record.validation_status = 'IMPORTED'::public.inventory_import_row_status then
    raise exception 'imported row cannot be edited';
  end if;

  if next_category not in ('KTM & Kartu', 'Elektronik', 'Tas', 'Dompet', 'Dokumen', 'Botol & Wadah', 'Aksesori', 'Lainnya') then
    raise exception 'invalid category';
  end if;

  if next_validation_status not in ('VALID'::public.inventory_import_row_status, 'WARNING'::public.inventory_import_row_status, 'ERROR'::public.inventory_import_row_status) then
    raise exception 'invalid validation status';
  end if;

  update public.inventory_import_rows
  set
    item_name = next_item_name,
    category = next_category,
    location_detail = next_location_detail,
    event_at = next_event_at,
    public_description = next_public_description,
    raw_status = next_raw_status,
    report_status = next_report_status,
    custody_status = next_custody_status,
    pickup_date = next_pickup_date,
    row_fingerprint = next_row_fingerprint,
    validation_status = next_validation_status,
    validation_messages = next_validation_messages,
    error_code = null,
    error_message = null
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
    'INVENTORY_IMPORT_ROW_UPDATED',
    pg_catalog.jsonb_build_object(
      'job_id', row_record.import_job_id,
      'source_row', row_record.source_row_number,
      'validation_status', row_record.validation_status
    )
  );

  return row_record;
end;
$$;

revoke all on function public.update_inventory_import_row(
  uuid, text, text, text, timestamptz, text, text, public.report_status, public.custody_status,
  timestamptz, text, public.inventory_import_row_status, jsonb
) from public, anon, authenticated;

grant execute on function public.update_inventory_import_row(
  uuid, text, text, text, timestamptz, text, text, public.report_status, public.custody_status,
  timestamptz, text, public.inventory_import_row_status, jsonb
) to authenticated;

drop function if exists public.import_inventory_row(uuid);

create or replace function public.import_inventory_row(
  target_row_id uuid,
  permanent_item_image_path text
)
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
  duplicate_report_id uuid;
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

  if row_record.validation_status not in ('VALID'::public.inventory_import_row_status, 'WARNING'::public.inventory_import_row_status) then
    raise exception 'row is not importable';
  end if;

  if row_record.event_at is null or row_record.report_status is null or row_record.custody_status is null then
    raise exception 'row has invalid normalized data';
  end if;

  if row_record.report_status = 'RESOLVED'::public.report_status
    and row_record.custody_status = 'HANDED_OVER'::public.custody_status
    and row_record.pickup_date is null then
    raise exception 'pickup date is required for resolved imported item';
  end if;

  select rows.report_id
  into duplicate_report_id
  from public.inventory_import_rows as rows
  where rows.row_fingerprint = row_record.row_fingerprint
    and rows.report_id is not null
    and rows.validation_status = 'IMPORTED'::public.inventory_import_row_status
    and rows.id <> row_record.id
  limit 1;

  if duplicate_report_id is not null then
    update public.inventory_import_rows
    set
      validation_status = 'SKIPPED'::public.inventory_import_row_status,
      report_id = duplicate_report_id,
      error_code = null,
      error_message = 'duplicate_row_fingerprint'
    where id = row_record.id
    returning * into row_record;

    update public.inventory_import_jobs
    set
      skipped_rows = (
        select count(*)
        from public.inventory_import_rows as rows
        where rows.import_job_id = job_record.id
          and rows.validation_status = 'SKIPPED'::public.inventory_import_row_status
      ),
      status = 'PARTIAL'::public.inventory_import_job_status
    where id = job_record.id;

    insert into public.audit_logs (
      actor_id,
      entity_type,
      entity_id,
      action,
      metadata
    ) values (
      actor_id,
      'inventory_import_row',
      row_record.id,
      'INVENTORY_IMPORT_ROW_SKIPPED_DUPLICATE',
      pg_catalog.jsonb_build_object(
        'job_id', job_record.id,
        'source_row', row_record.source_row_number,
        'report_id', duplicate_report_id
      )
    );

    return query select row_record.id, duplicate_report_id, row_record.validation_status;
    return;
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
        then row_record.pickup_date
      else null
    end
  );

  if permanent_item_image_path is not null then
    insert into public.report_images (
      report_id,
      storage_path,
      alt_text,
      sort_order
    ) values (
      next_report_id,
      permanent_item_image_path,
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
    'INVENTORY_IMPORT_ROW_IMPORTED',
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
      'image_count', case when permanent_item_image_path is null then 0 else 1 end
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
    skipped_rows = (
      select count(*)
      from public.inventory_import_rows as rows
      where rows.import_job_id = job_record.id
        and rows.validation_status = 'SKIPPED'::public.inventory_import_row_status
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
      error_message = 'import_failed'
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
      'INVENTORY_IMPORT_ROW_FAILED',
      pg_catalog.jsonb_build_object(
        'error_code', sqlstate,
        'safe_message', 'import_failed'
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

revoke all on function public.import_inventory_row(uuid, text)
from public, anon, authenticated;

grant execute on function public.import_inventory_row(uuid, text)
to authenticated;

create or replace function public.import_inventory_row(target_row_id uuid)
returns table (
  import_row_id uuid,
  report_id uuid,
  validation_status public.inventory_import_row_status
)
language sql
security definer
set search_path = ''
as $$
  select *
  from public.import_inventory_row(target_row_id, null::text)
$$;

revoke all on function public.import_inventory_row(uuid)
from public, anon, authenticated;

grant execute on function public.import_inventory_row(uuid)
to authenticated;

create or replace function public.expire_inventory_files()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
  job_record record;
begin
  if auth.uid() is not null and public.current_app_role() <> 'admin'::public.application_role then
    raise exception 'admin role required';
  end if;

  for job_record in
    select id, requested_by, storage_path
    from public.inventory_import_jobs
    where expires_at is not null
      and expires_at <= now()
      and status <> 'EXPIRED'::public.inventory_import_job_status
  loop
    delete from storage.objects
    where bucket_id = 'inventory-imports'
      and name like job_record.requested_by::text || '/' || job_record.id::text || '/%';

    update public.inventory_import_jobs
    set status = 'EXPIRED'::public.inventory_import_job_status
    where id = job_record.id;

    insert into public.audit_logs (actor_id, entity_type, entity_id, action, metadata)
    values (auth.uid(), 'inventory_import_job', job_record.id, 'INVENTORY_IMPORT_EXPIRED', '{}'::jsonb);

    affected := affected + 1;
  end loop;

  for job_record in
    select id, requested_by, storage_path
    from public.export_jobs
    where expires_at is not null
      and expires_at <= now()
      and status <> 'EXPIRED'::public.export_job_status
  loop
    if job_record.storage_path is not null then
      delete from storage.objects
      where bucket_id = 'inventory-exports'
        and name = job_record.storage_path;
    end if;

    update public.export_jobs
    set status = 'EXPIRED'::public.export_job_status
    where id = job_record.id;

    insert into public.audit_logs (actor_id, entity_type, entity_id, action, metadata)
    values (auth.uid(), 'export_job', job_record.id, 'INVENTORY_EXPORT_EXPIRED', '{}'::jsonb);

    affected := affected + 1;
  end loop;

  return affected;
end;
$$;

revoke all on function public.expire_inventory_files()
from public, anon, authenticated;

grant execute on function public.expire_inventory_files()
to authenticated;
