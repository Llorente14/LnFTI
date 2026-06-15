# Role-based access control

LNFTI combines PostgreSQL grants with Row Level Security. RLS limits rows, while column-level grants prevent browser clients from mutating workflow, audit, and verification fields.

## Access matrix

| Resource | Anonymous | Student | Verifier | Admin |
| --- | --- | --- | --- | --- |
| `public_reports` | Read published/matching rows | Read published/matching rows | Read | Read |
| `profiles` | None | Own profile | All profiles | All profiles |
| `reports` | None | Own rows; create/edit draft or pending; delete own draft | Read all | Read all |
| `report_images` | Safe public metadata view only | Metadata for own editable reports | Read all metadata | Read all metadata |
| `claims` | None | Own claims; create pending claim; cancel own pending claim | Read all | Read all |
| `handovers` | None | Rows where the student is recipient | Read all | Read all |
| `audit_logs` | None | None | Read all | Read all |
| `export_jobs` | None | None | Read all | Read all |

## Public browsing

Anonymous browsing uses `public.public_reports`. The view excludes reporter identifiers, private item characteristics, exact location details, and review fields. The base `reports` table is never granted to `anon`.

Public image browsing uses `public.public_report_images` plus a narrow Storage `SELECT` policy for `report-images` objects already attached to `PUBLISHED` or `MATCHING` reports. The bucket remains private, pages generate short-lived signed URLs rather than public URLs, and object paths contain report/object UUIDs only—not reporter UUIDs.

## Workflow writes

Students receive only the columns needed for report and claim input. They cannot set review actors, publish timestamps, custody decisions, claim decisions, or audit records.

Verifier/admin workflow mutations are intentionally not granted directly. Report decisions, claim approval, role administration, export creation, and handover processing must use audited PostgreSQL RPCs from their dedicated Jira tickets.

### Report review workflow

`LNFTI-18` adds `public.review_report(uuid, public.report_review_decision, text)` for verifier/admin report decisions. The only allowed transitions are `PENDING_REVIEW -> PUBLISHED` for `APPROVE` and `PENDING_REVIEW -> REJECTED` for `REJECT`. Both decisions require a trimmed reason between 5 and 500 characters.

The RPC writes one append-only `audit_logs` row in the same transaction. Approval uses `REPORT_REVIEW_APPROVED`; rejection uses `REPORT_REVIEW_REJECTED`. The `before_data` and `after_data` payloads contain only `report_status`, `custody_status`, `reviewed_by`, `reviewed_at`, `rejection_reason`, and `published_at`. Metadata contains `reason`, `decision`, `report_type`, and `source`.

`public.set_report_custody_status(uuid, public.custody_status, text)` updates only `custody_status` for non-draft reports and audits `REPORT_CUSTODY_CHANGED`. Supported custody values are `WITH_FINDER`, `AT_DPM`, `HANDED_OVER`, and `UNKNOWN`. `HANDED_OVER` is only a manual audited marker in this workflow; transactional handover rows remain deferred to `LNFTI-21`. Claim review remains deferred to `LNFTI-20`.

Both RPCs grant `EXECUTE` only to `authenticated` and independently require `current_app_role()` to be `verifier` or `admin`. Authenticated students have execute privilege but are denied inside the functions. Browser and Server Actions use the publishable key only; no service-role key is used. Public page revalidation runs after review mutations, but `public.public_reports` and `public.public_report_images` remain the only anonymous report sources. Apply the migration through normal local/CI reset flow; do not run remote `supabase db push`.

## Key boundary

The browser uses only the Supabase publishable/anon key. Service-role and secret keys remain server-only and must never appear in `NEXT_PUBLIC_*`, browser bundles, or client-side tests.

## Storage boundary

`LNFTI-15` adds a private `report-images` bucket and direct Storage object policies. Verified students can upload and delete only paths for their own `DRAFT` or `PENDING_REVIEW` reports. Verifier/admin roles can read objects only. Anonymous users can read only objects attached to public reports; anonymous writes, object updates, overwrite, upsert, rename, and move are denied.

See `docs/STORAGE.md` for path format and metadata consistency rules.
