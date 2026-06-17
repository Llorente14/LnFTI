# Database Workflow

## Prerequisites

- Node.js 20.9 or newer.
- npm 10 or newer.
- Supabase CLI.
- Docker Desktop or another Docker runtime available to the Supabase CLI.

Install the CLI locally when needed:

```bash
npm install --global supabase@2.106.0
```

## Environment Files

The local web environment file is intentionally:

```text
apps/web/.env.local
```

It is ignored by Git through `.gitignore` via `.env.*`. Keep real credentials out of commits, logs, screenshots, and pull request descriptions.

Use `apps/web/.env.example` as the safe template:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Local env files live only on the developer machine. Codex Cloud environment values, when provided, live only in the task sandbox. GitHub repository files must contain placeholders and documentation only.

Only these client-safe values belong in `apps/web/.env.local` for the web app:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Also set this server-only value for auth redirects:

```text
APP_ORIGIN
```

`APP_ORIGIN` must be the trusted application origin. `http` is allowed only for `localhost` and `127.0.0.1`; hosted environments must use `https`. Do not include username, password, path, query, or fragment.

Do not store database passwords, access tokens, or privileged Supabase keys in repository files.

## Local Supabase

Start local services:

```bash
npx supabase start
```

Reset the local database from an empty state and apply all migrations:

```bash
npx supabase db reset
```

Run database tests:

```bash
npx supabase test db
```

Inspect migration status:

```bash
npx supabase migration list
```

Create a new migration:

```bash
npx supabase migration new descriptive_name
```

Migrations live in:

```text
supabase/migrations/
```

Database tests live in:

```text
supabase/tests/database/
```

## LNFTI-12 Scope

This ticket adds local database tooling, the initial lost-and-found schema migration, append-only audit infrastructure, export job schema, and pgTAP database tests.

Remote database push was not performed. Remote deployment requires separate explicit approval.

## LNFTI-13 Institutional Auth Schema

Migration:

```text
supabase/migrations/20260614030000_institutional_auth_profiles.sql
```

This migration adds institutional reference data and trusted profile bootstrap logic:

- `public.organizations`
- `public.nim_prefixes`
- `public.profile_verification_status`
- profile columns for `nim`, `organization_id`, `nim_prefix`, `program_study_code`, `cohort_year`, `verification_status`, and `verified_at`
- auth triggers for signup and institutional email-change protection
- minimum own-profile `SELECT` policy only

Seeded UNTAR FTI rules:

| Program | Prefix | Cohorts | Email domain |
| --- | --- | --- | --- |
| Teknik Informatika | `535` | `24`, `25` | `stu.untar.ac.id` |
| Sistem Informasi | `825` | `24`, `25` | `stu.untar.ac.id` |

The auth trigger accepts only signup metadata `full_name` and `nim`. Role, organization, program, cohort, and verification fields are derived inside the database and are not trusted from browser metadata.

Auth email confirmation and profile verification are separate states. Supabase Auth owns `auth.users.email_confirmed_at`; the application keeps new profiles at `verification_status = 'UNVERIFIED'` until a verifier/admin business review changes them to `VERIFIED`. Email confirmation must not auto-verify profiles.

Email confirmation links must point to the configured app origin and `/auth/confirm`. The route accepts only Supabase signup/email confirmation token types and rejects invite, magiclink, recovery, and email-change tokens.

Local Supabase uses this committed template:

```text
supabase/templates/confirmation.html
```

Hosted Supabase confirmation template body:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Konfirmasi akun</a>
```

`RedirectTo` is supplied by the server-side signup/resend actions and includes `/auth/confirm?next=<sanitized internal path>`. In production, configure `APP_ORIGIN=https://ln-fti.vercel.app` so generated links target `https://ln-fti.vercel.app/auth/confirm` and never localhost.

Broad role-based RLS remains delegated to LNFTI-14. This ticket adds only authenticated users reading their own profile. It does not add report, claim, handover, audit, export, storage, or verifier policies.

Run the database suite after changing migrations:

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --level warning
```

The LNFTI-13 pgTAP file has 33 assertions. The LNFTI-12 initial schema file keeps its 91 planned assertions while allowing the new own-profile policy.

Run app-session integration with local Supabase and the Next.js app:

```bash
cd apps/web
RUN_SUPABASE_AUTH_INTEGRATION=1 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local-anon-or-publishable-key> \
APP_ORIGIN=http://127.0.0.1:3000 \
NEXT_APP_URL=http://127.0.0.1:3000 \
MAILPIT_URL=http://127.0.0.1:54324 \
SUPABASE_DB_HOST=127.0.0.1 \
SUPABASE_DB_PORT=54322 \
SUPABASE_DB_USER=postgres \
SUPABASE_DB_PASSWORD=postgres \
SUPABASE_DB_NAME=postgres \
npm run test:auth-integration
```

The integration suite verifies Supabase profile creation, unverified profile state, Mailpit confirmation link exchange, browser registration, SSR cookies, profile reload, app login, `email_not_confirmed` messaging, invalid-login generic error, logout, unauthenticated redirect, and duplicate email/NIM generic error behavior.

Remote database push was not performed for LNFTI-13.

## LNFTI-15 Report Image Storage

Migration:

```text
supabase/migrations/20260614150000_report_image_storage.sql
```

This migration creates the private `report-images` Storage bucket, caps files at 5 MiB, allows only JPEG/PNG/WebP MIME types, and adds object policies for owner upload/delete plus owner/verifier/admin read access. Direct anonymous reads and object updates are not allowed.

Report image object paths must use:

```text
<user_id>/<report_id>/<object_uuid>.<extension>
```

`public.report_images.storage_path` stores this object path, not a public URL. Upload UI remains deferred to LNFTI-16. Public image delivery remains deferred to LNFTI-17. Remote database push was not performed for LNFTI-15.

## LNFTI-34 Inventory Import and Export

Migrations:

```text
supabase/migrations/20260617070000_inventory_import_export.sql
supabase/migrations/20260617110000_inventory_import_export_hardening.sql
```

These migrations add verifier/admin inventory import metadata, private pickup-evidence metadata, import/export storage buckets, and audited inventory RPCs:

- `public.inventory_import_jobs`
- `public.inventory_import_rows`
- `public.inventory_pickup_evidence`
- `storage.buckets` entries for `inventory-imports` and `inventory-exports`
- `public.update_inventory_import_row(...)`
- `public.import_inventory_row(target_row_id uuid, permanent_item_image_path text)`
- `public.expire_inventory_files()`

The import flow stores parsed workbook rows before creating reports. Only verifier/admin users can preview, correct, and commit imports. Row edits are normalized server-side and persisted through `update_inventory_import_row`, which rechecks role, ownership, official category, dates, mapped status, duplicate fingerprint, and audit logging.

Workbook files, item photos, and pickup evidence are first staged in the private `inventory-imports` bucket under `<user_id>/<job_id>/...`. During commit, the application promotes staged item photos to the private `report-images` bucket and passes the permanent path into `import_inventory_row`. Pickup evidence remains private in `inventory-imports` and is tracked in `public.inventory_pickup_evidence`; it is not exposed through public report image views.

The import RPC re-checks role, job ownership, normalized row validity, pickup-date requirements, and importability inside the database before inserting a `FOUND` report. Cross-job duplicate row fingerprints are marked `SKIPPED` and linked to the existing report instead of creating another report.

Exports reuse `public.export_jobs` with `dataset = 'dpm_inventory'` and write generated files to the private `inventory-exports` bucket. The web UI returns an internal download route, not a storage signed URL. The route authenticates the user, rechecks ownership/admin access, rejects expired jobs, and creates a short-lived signed URL only at download time.

Sensitive XLSX export of pickup evidence is admin-only, requires a reason, stores `include_sensitive = true`, uses a shorter expiry, and is audited. CSV exports never include binary files, signed URLs, private storage paths, or pickup evidence.

`expire_inventory_files()` marks expired import/export jobs as `EXPIRED`, deletes staged import files and export files, and writes inventory audit events. It does not delete permanent report images created from successfully imported rows.

Run the database suite after changing this migration:

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --level warning
```

If local Docker/Supabase is unavailable, do not treat that as a blocker for LNFTI-34 local development. Use repository GitHub Actions as the authoritative validation for starting local Supabase, resetting the database from migrations, running pgTAP/database tests, running database lint, auth integration tests, and MVP integration tests.

Do not run `supabase db push`, migration repair, destructive production commands, or `supabase db lint --linked` against production merely to replace local Docker testing.

Remote database push was not performed for LNFTI-34.
