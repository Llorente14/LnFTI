# Role-based access control

LNFTI combines PostgreSQL grants with Row Level Security. RLS limits rows, while column-level grants prevent browser clients from mutating workflow, audit, and verification fields.

## Access matrix

| Resource | Anonymous | Student | Verifier | Admin |
| --- | --- | --- | --- | --- |
| `public_reports` | Read published/matching rows | Read published/matching rows | Read | Read |
| `profiles` | None | Own profile | All profiles | All profiles |
| `reports` | None | Own rows; create/edit draft or pending; delete own draft | Read all | Read all |
| `report_images` | None | Metadata for own editable reports | Read all metadata | Read all metadata |
| `claims` | None | Own claims; create pending claim; cancel own pending claim | Read all | Read all |
| `handovers` | None | Rows where the student is recipient | Read all | Read all |
| `audit_logs` | None | None | Read all | Read all |
| `export_jobs` | None | None | Read all | Read all |

## Public browsing

Anonymous browsing uses `public.public_reports`. The view excludes reporter identifiers, private item characteristics, exact location details, and review fields. The base `reports` table is never granted to `anon`.

## Workflow writes

Students receive only the columns needed for report and claim input. They cannot set review actors, publish timestamps, custody decisions, claim decisions, or audit records.

Verifier/admin workflow mutations are intentionally not granted directly. Report decisions, claim approval, role administration, export creation, and handover processing must use audited PostgreSQL RPCs from their dedicated Jira tickets.

## Key boundary

The browser uses only the Supabase publishable/anon key. Service-role and secret keys remain server-only and must never appear in `NEXT_PUBLIC_*`, browser bundles, or client-side tests.

## Storage boundary

`LNFTI-15` adds a private `report-images` bucket and direct Storage object policies. Verified students can upload and delete only paths for their own `DRAFT` or `PENDING_REVIEW` reports. Verifier/admin roles can read objects only. Anonymous direct access, object updates, overwrite, upsert, rename, and move are denied.

See `docs/STORAGE.md` for path format and metadata consistency rules.
