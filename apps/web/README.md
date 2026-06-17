# LnFTI Web Application

Next.js App Router application for the LnFTI lost-and-found platform.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer

## Local development

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

Set the Supabase values in `.env.local` before opening the app:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
APP_ORIGIN=http://localhost:3000
```

Open `http://localhost:3000`.

Use the Project URL and Publishable key from the Supabase Dashboard Connect dialog.
Do not place secret keys or service-role keys in `NEXT_PUBLIC_*` variables.
Set `APP_ORIGIN` to the trusted app origin only. `http` is accepted only for `localhost` and `127.0.0.1`; hosted environments must use `https`. Do not include a path, query, fragment, username, or password.
The app uses separate Supabase helpers for browser code and server-only code in `src/lib/supabase`.
Database migration and local Supabase commands are documented in `../../docs/DATABASE.md`.

## Institutional authentication

LnFTI uses Supabase Auth with email/password only. NextAuth, OAuth, OTP login, and service-role clients are not used in the web app.

Registration accepts UNTAR FTI student identities:

- Teknik Informatika: `53524NNNN` or `53525NNNN`
- Sistem Informasi: `82524NNNN` or `82525NNNN`
- Institutional email: `<normalized-first-name>.<NIM>@stu.untar.ac.id`

The first name is normalized from the first token in the full name, lowercased, and stripped to `a-z`. Example: `Axel Chrisdy` with `535240143` becomes `axel.535240143@stu.untar.ac.id`.

Local Supabase has email confirmation enabled in `supabase/config.toml`, and Mailpit receives local confirmation messages. Hosted projects should enable email confirmation and configure:

- Email/password provider enabled.
- Site URL set to the deployed app URL.
- Redirect URL for `/auth/confirm`.
- Confirmation template using `TokenHash`, `RedirectTo`, and `type=email`.
- SMTP provider before production launch.

The confirmation route rejects invite, magiclink, recovery, and email-change tokens. Recovery tokens are not exchanged into a profile session.

Hosted confirmation template body:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Konfirmasi akun</a>
```

`RedirectTo` comes from the server-side `emailRedirectTo` value and already contains the sanitized `next` path.

Private pages under `/me/*`, `/report/new`, and `/admin/*` redirect unauthenticated users to `/login?next=...`. Server components re-check the user with Supabase `getUser()`.

## Auth integration test

With local Supabase running and the web app available:

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

Use only the local anon/publishable key. Do not pass a service-role key to browser or test client env.

## Verification

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Local Docker/Supabase is optional for developer machines. Database reset, database tests, database lint, auth integration, and MVP integration are validated by repository GitHub Actions for PR review. Do not run production-linked Supabase commands as a substitute for local Docker testing.

## DPM inventory import/export

Verifier/admin users can manage DPM inventory snapshots from `/admin/inventory`.

- `/admin/inventory/import` previews `.xlsx` workbooks, reads embedded worksheet images through OOXML relationships, stages workbook/media in `inventory-imports`, allows verifier/admin row corrections, and commits selected `VALID`/`WARNING` rows through the audited `import_inventory_row` RPC.
- `/admin/inventory/export` creates filtered XLSX or CSV snapshots for found reports, embeds XLSX item images server-side, records the job in `export_jobs`, stores files in the private `inventory-exports` bucket, and returns an internal download route.
- Sensitive pickup-evidence export is admin-only, XLSX-only, reason-gated, shorter-lived, and audited. CSV exports only contain safe image-presence indicators.

Do not commit production workbooks, exported files, signed URLs, or credentials. Operational steps are documented in `../../docs/MVP_OPERATION_GUIDE.md`.

## Report submission

`/report/new` is protected by Supabase Auth and lets verified students submit `LOST` or `FOUND` reports. Submitted reports are created as temporary `DRAFT` rows, optional images are uploaded to the private `report-images` bucket, image metadata is inserted, and the report is finalized as `PENDING_REVIEW`.

Fields include report type, item name, category, public description, optional private characteristics, campus, building, location detail, event date/time, and up to three optional images. Supported image formats are JPEG, PNG, and WebP, with a 5 MiB limit per file. Private characteristics are for verification only and must not appear in public-facing previews.

If upload or finalization fails, the app removes uploaded objects when possible, deletes image metadata, and deletes the temporary draft report. AI suggestions are not required for submission; future LNFTI-27 suggestions must remain editable. Public browsing remains LNFTI-17, DPM review remains LNFTI-18, and no remote `supabase db push` is performed for this flow.

## Public report browsing

`/` shows the latest six public reports, `/reports` lists public reports with server-side search, filters, and 12-item pagination, and `/reports/[id]` shows a public detail page. Browsing does not require login.

Public pages query `public.public_reports` and `public.public_report_images` only. They show `PUBLISHED` and `MATCHING` reports, and never select private characteristics, exact location detail, reporter identity, contact data, review fields, claim evidence, or OCR raw text.

Supported filters are `q`, `type`, `category`, `campus`, `building`, `status`, `date_from`, `date_to`, and `page`. Report images stay in the private `report-images` bucket and are delivered with short-lived signed URLs; missing or unsigned images fall back to category placeholders. Claim workflow remains deferred, and no remote `supabase db push` is performed for this flow.
