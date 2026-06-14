-- LNFTI-17 public image metadata and private Storage delivery policy.
--
-- The report-images bucket stays private. Public pages may read only image
-- objects attached to reports already visible through public.public_reports.
--
-- Public image paths intentionally omit the reporter UUID. The privacy-safe
-- format is: <report_id>/<object_uuid>.<extension>.

create or replace function public.is_report_image_object_path_allowed(
  object_name text,
  require_editable_report boolean
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  path_parts text[];
  target_report_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return false;
  end if;

  if object_name is null or object_name <> btrim(object_name) then
    return false;
  end if;

  path_parts := regexp_split_to_array(object_name, '/');

  if array_length(path_parts, 1) <> 2 then
    return false;
  end if;

  if path_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  if path_parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;

  target_report_id := path_parts[1]::uuid;

  return exists (
    select 1
    from public.reports as reports
    where reports.id = target_report_id
      and reports.reporter_id = current_user_id
      and (
        not require_editable_report
        or reports.report_status in (
          'DRAFT'::public.report_status,
          'PENDING_REVIEW'::public.report_status
        )
      )
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_report_image_object_path_allowed(text, boolean)
from public, anon, authenticated;

grant execute on function public.is_report_image_object_path_allowed(text, boolean)
to authenticated;

create or replace view public.public_report_images
with (security_barrier = true)
as
select
  report_images.report_id,
  report_images.storage_path,
  report_images.alt_text,
  report_images.sort_order
from public.report_images as report_images
join public.reports as reports
  on reports.id = report_images.report_id
where reports.report_status in (
  'PUBLISHED'::public.report_status,
  'MATCHING'::public.report_status
);

revoke all privileges on public.public_report_images from public, anon, authenticated;
grant select on public.public_report_images to anon, authenticated;

comment on view public.public_report_images is
  'Safe public image metadata for published/matching reports only. Paths contain report/object UUIDs and never reporter UUIDs.';

create or replace function public.is_public_report_image_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  path_parts text[];
  target_report_id uuid;
begin
  if object_name is null or object_name <> btrim(object_name) then
    return false;
  end if;

  path_parts := regexp_split_to_array(object_name, '/');

  if array_length(path_parts, 1) <> 2 then
    return false;
  end if;

  if path_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  if path_parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;

  target_report_id := path_parts[1]::uuid;

  return exists (
    select 1
    from public.report_images as report_images
    join public.reports as reports
      on reports.id = report_images.report_id
    where report_images.storage_path = object_name
      and report_images.report_id = target_report_id
      and reports.report_status in (
        'PUBLISHED'::public.report_status,
        'MATCHING'::public.report_status
      )
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_public_report_image_object(text)
from public, anon, authenticated;

grant execute on function public.is_public_report_image_object(text)
to anon, authenticated;

drop policy if exists storage_report_images_select_public_reports
on storage.objects;

create policy storage_report_images_select_public_reports
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'report-images'
  and public.is_public_report_image_object(name)
);
