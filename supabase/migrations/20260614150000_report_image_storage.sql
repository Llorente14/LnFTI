-- LNFTI-15 report image Storage configuration.
--
-- Browser clients may upload only private report images for their own editable
-- reports. Public delivery is deferred to LNFTI-17.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'report-images',
  'report-images',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
  report_id uuid;
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

  if array_length(path_parts, 1) <> 3 then
    return false;
  end if;

  if path_parts[1] <> current_user_id::text then
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
    from public.reports as reports
    where reports.id = report_id
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

alter table storage.objects enable row level security;

drop policy if exists storage_report_images_insert_verified_owner_editable
on storage.objects;

create policy storage_report_images_insert_verified_owner_editable
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-images'
  and public.is_verified_student()
  and public.is_report_image_object_path_allowed(name, true)
);

drop policy if exists storage_report_images_select_owner_verifier_admin
on storage.objects;

create policy storage_report_images_select_owner_verifier_admin
on storage.objects
for select
to authenticated
using (
  bucket_id = 'report-images'
  and (
    public.is_report_image_object_path_allowed(name, false)
    or public.current_app_role() in (
      'verifier'::public.application_role,
      'admin'::public.application_role
    )
  )
);

drop policy if exists storage_report_images_delete_owner_editable
on storage.objects;

create policy storage_report_images_delete_owner_editable
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'report-images'
  and public.is_report_image_object_path_allowed(name, true)
);
