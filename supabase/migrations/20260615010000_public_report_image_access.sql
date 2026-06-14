-- LNFTI-17 public image metadata and private Storage delivery policy.
--
-- The report-images bucket stays private. Public pages may read only image
-- objects attached to reports already visible through public.public_reports.

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
  'Safe public image metadata for published/matching reports only. Stores private Storage paths, not public URLs.';

create or replace function public.is_public_report_image_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  path_parts text[];
  report_id uuid;
begin
  if object_name is null or object_name <> btrim(object_name) then
    return false;
  end if;

  path_parts := regexp_split_to_array(object_name, '/');

  if array_length(path_parts, 1) <> 3 then
    return false;
  end if;

  if path_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  if path_parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  if path_parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;

  report_id := path_parts[2]::uuid;

  return exists (
    select 1
    from public.report_images as report_images
    join public.reports as reports
      on reports.id = report_images.report_id
    where report_images.storage_path = object_name
      and report_images.report_id = report_id
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
