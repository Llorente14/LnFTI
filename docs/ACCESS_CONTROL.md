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

### Ownership claim submission

`LNFTI-19` lets verified students submit ownership claims for public `FOUND` reports only when the report is `PUBLISHED`, has not been marked `HANDED_OVER`, belongs to another user, and the claimant does not already have an active claim for that report. Active duplicate prevention is enforced by a partial unique index on `(report_id, claimant_id)` for `PENDING`, `APPROVED`, and `COMPLETED` claims; `REJECTED`, `EXPIRED`, and `CANCELLED` claims allow later resubmission.

Claim evidence is stored in `claims.ownership_evidence_private`, must be 20-2000 trimmed characters, and remains private to the claimant plus verifier/admin roles. It is not included in public report views, report cards, public detail metadata, URLs, audit metadata, or logs. Claim submission inserts only `report_id`, session-derived `claimant_id`, and private evidence; the database default sets `claim_status = PENDING`.

Eligibility checks fail closed when ownership or existing-claim lookups fail, while PostgreSQL RLS and `can_claim_report()` remain the authoritative boundary. `/me/claims` shows the current user's own claims, private evidence, safe public report information when still available through `public.public_reports`, and a generic unavailable message when the report is no longer public. Pending claims can be cancelled by the claimant only through `PENDING -> CANCELLED`; rows are never deleted. Submission and cancellation revalidate the affected report detail so claim eligibility is refreshed.

Submission and cancellation do not change `report_status`, `custody_status`, review fields, or publish timestamps. Browser and Server Actions use the publishable key only, and no remote `supabase db push` should be run.

### Claim review workflow

`LNFTI-20` adds `public.review_claim(uuid, public.claim_review_decision, text)` for verifier/admin ownership decisions. `APPROVE` moves a `PENDING` claim to `APPROVED` and moves the related `PUBLISHED` `FOUND` report to `MATCHING`; all other `PENDING` claims for that report become `REJECTED` with a standard automatic reason. `REJECT` moves only the selected `PENDING` claim to `REJECTED` and keeps the report `PUBLISHED`.

Claim decision reasons are required, trimmed, and 5-500 characters. Audit actions are `CLAIM_APPROVED`, `CLAIM_REJECTED`, `CLAIM_AUTO_REJECTED`, and `REPORT_MATCHING_STARTED`. Claim audit snapshots include only `claim_status`, `decided_by`, `decided_at`, `decision_reason`, and `expires_at`; report transition snapshots include only `report_status` and `custody_status`. Evidence is never written to audit logs.

After approval, `MATCHING` reports remain visible publicly but no longer accept new claims. Report creators still cannot read claimant evidence by default; explicit consent would need a future feature. Physical handover, `COMPLETED`, `RESOLVED`, and custody `HANDED_OVER` are handled by the transactional workflow below. Automatic claim expiry is not implemented here.

### Transactional handover workflow

`LNFTI-21` adds `public.complete_handover(uuid, text, text)` for verifier/admin physical handover. The browser sends only claim ID, handover location, and optional notes. The database derives `report_id` from `claims.report_id`, `recipient_id` from `claims.claimant_id`, `verifier_id` from `auth.uid()`, and `handover_at` from `transaction_timestamp()`.

The final state machine is:

```text
Report:  PENDING_REVIEW -> PUBLISHED -> MATCHING -> RESOLVED
Claim:   PENDING -> APPROVED -> COMPLETED
Custody: UNKNOWN / WITH_FINDER / AT_DPM -> HANDED_OVER
```

Only an `APPROVED` claim on a `FOUND` report in `MATCHING` status may be completed. The report must not already be resolved or handed over, the claimant profile must exist, and one handover is allowed per claim/report through unique constraints plus RPC checks. The lock order is: read `claim.report_id`, lock the report row, lock all claims for the report ordered by claim ID, check existing handovers, re-read the target claim, then insert/update/audit.

The RPC inserts one handover row, moves the claim to `COMPLETED`, moves the report to `RESOLVED`, sets custody to `HANDED_OVER`, and populates `resolved_at` using the same transaction timestamp. Audit events are `HANDOVER_COMPLETED`, `CLAIM_COMPLETED`, and `REPORT_RESOLVED_BY_HANDOVER`. Audit payloads exclude ownership evidence, private report details, contact details, and handover notes.

Manual custody changes can set only `UNKNOWN`, `WITH_FINDER`, or `AT_DPM`. `set_report_custody_status()` rejects `HANDED_OVER`, already handed-over custody, `RESOLVED` reports, and `CLOSED` reports. After resolution the report disappears from public report views, while the claimant keeps private claim and handover history in `/me/claims`. Realtime remains deferred to `LNFTI-22`, and no service-role key or remote `supabase db push` is required.

### Report review workflow

`LNFTI-18` adds `public.review_report(uuid, public.report_review_decision, text)` for verifier/admin report decisions. The only allowed transitions are `PENDING_REVIEW -> PUBLISHED` for `APPROVE` and `PENDING_REVIEW -> REJECTED` for `REJECT`. Both decisions require a trimmed reason between 5 and 500 characters.

The RPC writes one append-only `audit_logs` row in the same transaction. Approval uses `REPORT_REVIEW_APPROVED`; rejection uses `REPORT_REVIEW_REJECTED`. The `before_data` and `after_data` payloads contain only `report_status`, `custody_status`, `reviewed_by`, `reviewed_at`, `rejection_reason`, and `published_at`. Metadata contains `reason`, `decision`, `report_type`, and `source`.

`public.set_report_custody_status(uuid, public.custody_status, text)` updates only `custody_status` for non-draft, unresolved reports and audits `REPORT_CUSTODY_CHANGED`. After `LNFTI-21`, supported manual custody values are `WITH_FINDER`, `AT_DPM`, and `UNKNOWN`; `HANDED_OVER` is reserved for `public.complete_handover(uuid, text, text)`. Claim review is handled by `LNFTI-20`.

Both RPCs grant `EXECUTE` only to `authenticated` and independently require `current_app_role()` to be `verifier` or `admin`. Authenticated students have execute privilege but are denied inside the functions. The `/admin`, `/admin/reports`, and `/admin/reports/[id]` pages repeat the verifier/admin role check before reading private report, reporter, location, or image data. Browser and Server Actions use the publishable key only; no service-role key is used. Public page revalidation runs after both review and custody mutations, while `public.public_reports` and `public.public_report_images` remain the only anonymous report sources. Apply the migration through normal local/CI reset flow; do not run remote `supabase db push`.

## Key boundary

The browser uses only the Supabase publishable/anon key. Service-role and secret keys remain server-only and must never appear in `NEXT_PUBLIC_*`, browser bundles, or client-side tests.

## Storage boundary

`LNFTI-15` adds a private `report-images` bucket and direct Storage object policies. Verified students can upload and delete only paths for their own `DRAFT` or `PENDING_REVIEW` reports. Verifier/admin roles can read objects only. Anonymous users can read only objects attached to public reports; anonymous writes, object updates, overwrite, upsert, rename, and move are denied.

See `docs/STORAGE.md` for path format and metadata consistency rules.
