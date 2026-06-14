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
- auth triggers for signup, email confirmation, and institutional email-change protection
- minimum own-profile `SELECT` policy only

Seeded UNTAR FTI rules:

| Program | Prefix | Cohorts | Email domain |
| --- | --- | --- | --- |
| Teknik Informatika | `535` | `24`, `25` | `stu.untar.ac.id` |
| Sistem Informasi | `825` | `24`, `25` | `stu.untar.ac.id` |

The auth trigger accepts only signup metadata `full_name` and `nim`. Role, organization, program, cohort, and verification fields are derived inside the database and are not trusted from browser metadata.

Email confirmation links must point to the configured app origin and `/auth/confirm`. The route accepts only Supabase signup/email confirmation token types and rejects invite, magiclink, recovery, and email-change tokens.

Local Supabase uses this committed template:

```text
supabase/templates/confirmation.html
```

Hosted Supabase confirmation template body:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Konfirmasi akun</a>
```

`RedirectTo` is supplied by the server-side signup action and includes `/auth/confirm?next=<sanitized internal path>`.

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

The integration suite verifies Supabase profile creation, pending email state, Mailpit confirmation link exchange, verified profile state, browser registration, SSR cookies, profile reload, app login, invalid-login generic error, logout, unauthenticated redirect, and duplicate email/NIM generic error behavior.

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
