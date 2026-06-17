-- LNFTI-34 final review fixes: RPC validation, duplicate race protection, and safe expiry metadata.

create unique index if not exists inventory_import_rows_imported_fingerprint_uidx
on public.inventory_import_rows (row_fingerprint)
where validation_status = 'IMPORTED'::public.inventory_import_row_status;

drop policy if exists export_jobs_update_owner_admin on public.export_jobs;

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
  public.current_app_role() = 'admin'::public.application_role
  or (
    public.current_app_role() = 'verifier'::public.application_role
    and requested_by = auth.uid()
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
  actor_id uuid := auth.uid();
  actor_role public.application_role := public.current_app_role();
  owns_entity boolean := false;
begin
  if actor_id is null or actor_role not in ('verifier'::public.application_role, 'admin'::public.application_role) then
    raise exception 'verifier or admin role required';
  end if;

  if event_entity_type = 'export_job' then
    if event_action not in (
      'INVENTORY_EXPORT_REQUESTED',
      'INVENTORY_EXPORT_SENSITIVE_REQUESTED',
      'INVENTORY_EXPORT_COMPLETED',
      'INVENTORY_EXPORT_FAILED',
      'INVENTORY_EXPORT_EXPIRED'
    ) then
      raise exception 'unsupported export audit action';
    end if;

    select exists (
      select 1 from public.export_jobs as jobs
      where jobs.id = event_entity_id
        and (jobs.requested_by = actor_id or actor_role = 'admin'::public.application_role)
    ) into owns_entity;
  elsif event_entity_type = 'inventory_import_job' then
    if event_action not in (
      'INVENTORY_IMPORT_JOB_CREATED',
      'INVENTORY_IMPORT_PARSED',
      'INVENTORY_IMPORT_CONFIRMED',
      'INVENTORY_IMPORT_RETRIED',
      'INVENTORY_IMPORT_EXPIRED'
    ) then
      raise exception 'unsupported import-job audit action';
    end if;

    select exists (
      select 1 from public.inventory_import_jobs as jobs
      where jobs.id = event_entity_id
        and (jobs.requested_by = actor_id or actor_role = 'admin'::public.application_role)
    ) into owns_entity;
  elsif event_entity_type = 'inventory_import_row' then
    if event_action <> 'INVENTORY_IMPORT_ROW_FAILED' then
      raise exception 'unsupported import-row audit action';
    end if;

    select exists (
      select 1
      from public.inventory_import_rows as rows
      join public.inventory_import_jobs as jobs on jobs.id = rows.import_job_id
      where rows.id = event_entity_id
        and (jobs.requested_by = actor_id or actor_role = 'admin'::public.application_role)
    ) into owns_entity;
  else
    raise exception 'unsupported inventory audit entity';
  end if;

  if not owns_entity then
    raise exception 'inventory audit entity access denied';
  end if;

  insert into public.audit_logs (actor_id, entity_type, entity_id, action, metadata)
  values (actor_id, event_entity_type, event_entity_id, event_action, coalesce(event_metadata, '{}'::jsonb));
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
  actor_id uuid := auth.uid();
  actor_role public.application_role := public.current_app_role();
  row_record public.inventory_import_rows%rowtype;
  job_record public.inventory_import_jobs%rowtype;
  normalized_status text := upper(regexp_replace(btrim(coalesce(next_raw_status, '')), '\s+', ' ', 'g'));
  expected_report_status public.report_status;
  expected_custody_status public.custody_status;
  expected_validation_status public.inventory_import_row_status;
begin
  if actor_id is null or actor_role not in ('verifier'::public.application_role, 'admin'::public.application_role) then
    raise exception 'verifier or admin role required';
  end if;

  select * into row_record
  from public.inventory_import_rows as rows
  where rows.id = target_row_id
  for update;

  if not found then raise exception 'import row not found'; end if;

  select * into job_record
  from public.inventory_import_jobs as jobs
  where jobs.id = row_record.import_job_id
  for update;

  if not found then raise exception 'import job not found'; end if;
  if job_record.requested_by <> actor_id and actor_role <> 'admin'::public.application_role then
    raise exception 'import job access denied';
  end if;
  if row_record.validation_status = 'IMPORTED'::public.inventory_import_row_status then
    raise exception 'imported row cannot be edited';
  end if;
  if length(btrim(coalesce(next_item_name, ''))) = 0 then raise exception 'item name is required'; end if;
  if length(btrim(coalesce(next_location_detail, ''))) = 0 then raise exception 'location is required'; end if;
  if length(btrim(coalesce(next_public_description, ''))) < 10 then raise exception 'public description is invalid'; end if;
  if next_row_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'row fingerprint is invalid'; end if;
  if next_category not in ('KTM & Kartu', 'Elektronik', 'Tas', 'Dompet', 'Dokumen', 'Botol & Wadah', 'Aksesori', 'Lainnya') then
    raise exception 'invalid category';
  end if;

  case normalized_status
    when 'SEKRE DPM' then
      expected_report_status := 'PUBLISHED'::public.report_status;
      expected_custody_status := 'AT_DPM'::public.custody_status;
    when 'PROKER' then
      expected_report_status := 'CLOSED'::public.report_status;
      expected_custody_status := 'AT_DPM'::public.custody_status;
    when 'SIAP DIDONASIKAN' then
      expected_report_status := 'CLOSED'::public.report_status;
      expected_custody_status := 'AT_DPM'::public.custody_status;
    when 'DIAMBIL MAHASISWA' then
      expected_report_status := 'RESOLVED'::public.report_status;
      expected_custody_status := 'HANDED_OVER'::public.custody_status;
    else
      expected_report_status := null;
      expected_custody_status := null;
  end case;

  if next_event_at is null or expected_report_status is null then
    expected_validation_status := 'ERROR'::public.inventory_import_row_status;
  elsif expected_report_status = 'RESOLVED'::public.report_status and next_pickup_date is null then
    expected_validation_status := 'ERROR'::public.inventory_import_row_status;
  elsif jsonb_array_length(coalesce(next_validation_messages, '[]'::jsonb)) > 0 then
    expected_validation_status := 'WARNING'::public.inventory_import_row_status;
  else
    expected_validation_status := 'VALID'::public.inventory_import_row_status;
  end if;

  if next_report_status is distinct from expected_report_status
    or next_custody_status is distinct from expected_custody_status
    or next_validation_status is distinct from expected_validation_status then
    raise exception 'normalized inventory mapping mismatch';
  end if;

  update public.inventory_import_rows
  set
    item_name = btrim(next_item_name),
    category = next_category,
    location_detail = btrim(next_location_detail),
    event_at = next_event_at,
    public_description = next_public_description,
    raw_status = normalized_status,
    report_status = expected_report_status,
    custody_status = expected_custody_status,
    pickup_date = next_pickup_date,
    row_fingerprint = next_row_fingerprint,
    validation_status = expected_validation_status,
    validation_messages = coalesce(next_validation_messages, '[]'::jsonb),
    report_id = case when row_record.validation_status in ('SKIPPED'::public.inventory_import_row_status, 'FAILED'::public.inventory_import_row_status) then null else report_id end,
    imported_at = case when row_record.validation_status in ('SKIPPED'::public.inventory_import_row_status, 'FAILED'::public.inventory_import_row_status) then null else imported_at end,
    error_code = null,
    error_message = null
  where id = target_row_id
  returning * into row_record;

  insert into public.audit_logs (actor_id, entity_type, entity_id, action, metadata)
  values (
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

create or replace function public.validate_inventory_report_image_path()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.alt_text = 'Foto barang import DPM'
    and new.storage_path !~ ('^' || new.report_id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid imported report image path';
  end if;
  return new;
end;
$$;

drop trigger if exists report_images_validate_inventory_path on public.report_images;
create trigger report_images_validate_inventory_path
before insert or update on public.report_images
for each row execute function public.validate_inventory_report_image_path();

create or replace function public.expire_inventory_files()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
  changed integer := 0;
begin
  if auth.uid() is not null and public.current_app_role() <> 'admin'::public.application_role then
    raise exception 'admin role required';
  end if;

  update public.inventory_import_jobs
  set status = 'EXPIRED'::public.inventory_import_job_status
  where expires_at is not null
    and expires_at <= now()
    and status <> 'EXPIRED'::public.inventory_import_job_status;
  get diagnostics changed = row_count;
  affected := affected + changed;

  update public.export_jobs
  set status = 'EXPIRED'::public.export_job_status
  where expires_at is not null
    and expires_at <= now()
    and status <> 'EXPIRED'::public.export_job_status;
  get diagnostics changed = row_count;
  affected := affected + changed;

  return affected;
end;
$$;

revoke all on function public.expire_inventory_files()
from public, anon, authenticated;

grant execute on function public.expire_inventory_files()
to authenticated;
