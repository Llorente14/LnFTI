# Storage

## Report Images

Jira `LNFTI-15` configures one private Supabase Storage bucket for report photos.

- Bucket ID and name: `report-images`
- Public access: disabled
- Maximum file size: 5 MiB / 5,242,880 bytes
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Required object path: `<report_id>/<object_uuid>.<extension>`
- Allowed extensions: `jpg`, `jpeg`, `png`, `webp`

Example path:

```text
2d2d0000-0000-0000-0000-000000000002/a8ad0000-0000-0000-0000-000000000003.webp
```

Reporter UUIDs are intentionally excluded from object paths because signed image URLs are visible to public viewers. Ownership is derived from the report row and the authenticated session instead of a user-ID folder.

Authenticated verified students may upload only under a report ID that belongs to them and remains `DRAFT` or `PENDING_REVIEW`. Students may delete only objects for their own editable reports.

Verifier and admin roles have read-only object access. Anonymous users receive a narrow `SELECT` policy only for objects already attached to `PUBLISHED` or `MATCHING` reports. Anonymous INSERT, UPDATE, and DELETE remain denied. No `UPDATE` policy exists, so direct overwrite, upsert, rename, and move are intentionally disabled.

`public.report_images.storage_path` stores the Storage object path, not a permanent public URL. Application code must upload the object, then insert metadata containing `report_id`, `storage_path`, `alt_text`, and `sort_order`. If metadata insertion fails, application code must remove the uploaded object through the Storage API. Deleting `report_images` metadata does not automatically delete the physical object.

Upload UI is implemented by `LNFTI-16`. `LNFTI-17` keeps the bucket private and adds public delivery through `public.public_report_images`, `public.is_public_report_image_object(text)`, and short-lived signed URLs for images attached to `PUBLISHED` or `MATCHING` reports only. Missing or unsigned images use category placeholders. Browser code must not use a service-role key. No remote `supabase db push` was performed for this setup.
