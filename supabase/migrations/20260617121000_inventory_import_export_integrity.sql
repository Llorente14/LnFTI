-- LNFTI-34 normalized row integrity and deferred job reconciliation.

create or replace function public.inventory_row_fingerprint(
  item_name_value text,
  location_value text,
  event_at_value timestamptz,
  raw_status_value text,
  item_image_sha256_value text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.lower(pg_catalog.btrim(coalesce(item_name_value, '')))
        || pg_catalog.chr(31)
        || pg_catalog.lower(pg_catalog.btrim(coalesce(location_value, '')))
        || pg_catalog.chr(31)
        || case
          when event_at_value is null then ''
          else pg_catalog.to_char(event_at_value at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        end
        || pg_catalog.chr(31)
        || pg_catalog.upper(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(raw_status_value, '')), '\s+', ' ', 'g'))
        || pg_catalog.chr(31)
        || coalesce(item_image_sha256_value, ''),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function public.inventory_row_fingerprint(text, text, timestamptz, text, text)
from public, anon, authenticated;

grant execute on function public.inventory_row_fingerprint(text, text, timestamptz, text, text)
to authenticated;

create or replace function public.validate_inventory_import_row_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  normalized_status text;
  expected_report_status public.report_status;
  expected_custody_status public.custody_status;
  expected_validation_status public.inventory_import_row_status;
  expected_fingerprint text;
begin
  normalized_status := pg_catalog.upper(
    pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(new.raw_status, '')), '\s+', ' ', 'g')
  );

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

  if new.report_status is distinct from expected_report_status
    or new.custody_status is distinct from expected_custody_status then
    raise exception 'inventory row status mapping mismatch';
  end if;

  expected_fingerprint := public.inventory_row_fingerprint(
    new.item_name,
    new.location_detail,
    new.event_at,
    normalized_status,
    new.item_image_sha256
  );

  if tg_op = 'INSERT' then
    new.row_fingerprint := expected_fingerprint;
  elsif new.row_fingerprint is distinct from expected_fingerprint then
    raise exception 'inventory row fingerprint mismatch';
  end if;

  if new.validation_status in (
    'VALID'::public.inventory_import_row_status,
    'WARNING'::public.inventory_import_row_status,
    'ERROR'::public.inventory_import_row_status
  ) then
    if pg_catalog.jsonb_typeof(new.validation_messages) <> 'array' then
      raise exception 'inventory validation messages must be an array';
    end if;

    if new.event_at is null or expected_report_status is null
      or (expected_report_status = 'RESOLVED'::public.report_status and new.pickup_date is null) then
      expected_validation_status := 'ERROR'::public.inventory_import_row_status;
    elsif pg_catalog.jsonb_array_length(new.validation_messages) > 0 then
      expected_validation_status := 'WARNING'::public.inventory_import_row_status;
    else
      expected_validation_status := 'VALID'::public.inventory_import_row_status;
    end if;

    if new.validation_status is distinct from expected_validation_status then
      raise exception 'inventory row validation status mismatch';
    end if;
  end if;

  new.raw_status := normalized_status;
  return new;
end;
$$;

drop trigger if exists inventory_import_rows_validate_integrity on public.inventory_import_rows;
create trigger inventory_import_rows_validate_integrity
before insert or update on public.inventory_import_rows
for each row execute function public.validate_inventory_import_row_integrity();

create or replace function public.reconcile_inventory_import_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job_id uuid;
  total_count integer;
  valid_count integer;
  warning_count integer;
  error_count integer;
  imported_count integer;
  skipped_count integer;
  failed_count integer;
  next_status public.inventory_import_job_status;
begin
  if tg_op = 'DELETE' then
    target_job_id := old.import_job_id;
  else
    target_job_id := new.import_job_id;
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (where validation_status = 'VALID'::public.inventory_import_row_status)::integer,
    pg_catalog.count(*) filter (where validation_status = 'WARNING'::public.inventory_import_row_status)::integer,
    pg_catalog.count(*) filter (where validation_status = 'ERROR'::public.inventory_import_row_status)::integer,
    pg_catalog.count(*) filter (where validation_status = 'IMPORTED'::public.inventory_import_row_status)::integer,
    pg_catalog.count(*) filter (where validation_status = 'SKIPPED'::public.inventory_import_row_status)::integer,
    pg_catalog.count(*) filter (where validation_status = 'FAILED'::public.inventory_import_row_status)::integer
  into total_count, valid_count, warning_count, error_count, imported_count, skipped_count, failed_count
  from public.inventory_import_rows
  where import_job_id = target_job_id;

  if failed_count > 0 or (error_count > 0 and imported_count + skipped_count > 0) then
    next_status := 'PARTIAL'::public.inventory_import_job_status;
  elsif imported_count + skipped_count > 0 and valid_count + warning_count > 0 then
    next_status := 'PROCESSING'::public.inventory_import_job_status;
  elsif valid_count + warning_count + error_count > 0 then
    next_status := 'READY'::public.inventory_import_job_status;
  else
    next_status := 'COMPLETED'::public.inventory_import_job_status;
  end if;

  update public.inventory_import_jobs
  set
    total_rows = total_count,
    valid_rows = valid_count,
    warning_rows = warning_count,
    error_rows = error_count,
    imported_rows = imported_count,
    skipped_rows = skipped_count,
    failed_rows = failed_count,
    status = next_status,
    completed_at = case
      when next_status = 'COMPLETED'::public.inventory_import_job_status then coalesce(completed_at, pg_catalog.now())
      else null
    end
  where id = target_job_id
    and status <> 'EXPIRED'::public.inventory_import_job_status;

  return null;
end;
$$;

drop trigger if exists inventory_import_rows_reconcile_job on public.inventory_import_rows;
create constraint trigger inventory_import_rows_reconcile_job
after insert or update or delete on public.inventory_import_rows
deferrable initially deferred
for each row execute function public.reconcile_inventory_import_job();

-- Metadata expiry remains callable for scheduled/admin maintenance. Storage bytes are
-- deleted through the authenticated cleanup route, never by deleting storage.objects rows.
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
    select id
    from public.inventory_import_jobs
    where expires_at is not null
      and expires_at <= pg_catalog.now()
      and status <> 'EXPIRED'::public.inventory_import_job_status
  loop
    update public.inventory_import_jobs
    set status = 'EXPIRED'::public.inventory_import_job_status
    where id = job_record.id;

    insert into public.audit_logs (actor_id, entity_type, entity_id, action, metadata)
    values (auth.uid(), 'inventory_import_job', job_record.id, 'INVENTORY_IMPORT_EXPIRED', '{"storage_cleanup":"pending"}'::jsonb);
    affected := affected + 1;
  end loop;

  for job_record in
    select id
    from public.export_jobs
    where expires_at is not null
      and expires_at <= pg_catalog.now()
      and status <> 'EXPIRED'::public.export_job_status
  loop
    update public.export_jobs
    set status = 'EXPIRED'::public.export_job_status
    where id = job_record.id;

    insert into public.audit_logs (actor_id, entity_type, entity_id, action, metadata)
    values (auth.uid(), 'export_job', job_record.id, 'INVENTORY_EXPORT_EXPIRED', '{"storage_cleanup":"pending"}'::jsonb);
    affected := affected + 1;
  end loop;

  return affected;
end;
$$;

revoke all on function public.expire_inventory_files()
from public, anon, authenticated;

grant execute on function public.expire_inventory_files()
to authenticated;
