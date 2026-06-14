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
```

Open `http://localhost:3000`.

Use the Project URL and Publishable key from the Supabase Dashboard Connect dialog.
Do not place secret keys or service-role keys in `NEXT_PUBLIC_*` variables.
The app uses separate Supabase helpers for browser code and server-only code in `src/lib/supabase`.
Database migration and local Supabase commands are documented in `../../docs/DATABASE.md`.

## Institutional authentication

LnFTI uses Supabase Auth with email/password only. NextAuth, OAuth, OTP login, and service-role clients are not used in the web app.

Registration accepts UNTAR FTI student identities:

- Teknik Informatika: `53524NNNN` or `53525NNNN`
- Sistem Informasi: `82524NNNN` or `82525NNNN`
- Institutional email: `<normalized-first-name>.<NIM>@stu.untar.ac.id`

The first name is normalized from the first token in the full name, lowercased, and stripped to `a-z`. Example: `Axel Chrisdy` with `535240143` becomes `axel.535240143@stu.untar.ac.id`.

Local Supabase has email confirmation disabled in `supabase/config.toml`, so a valid signup may immediately create a usable session. Hosted projects should enable email confirmation and configure:

- Email/password provider enabled.
- Site URL set to the deployed app URL.
- Redirect URL for `/auth/confirm`.
- Confirmation template using Supabase `token_hash` links.
- SMTP provider before production launch.

Private pages under `/me/*`, `/report/new`, and `/admin/*` redirect unauthenticated users to `/login?next=...`. Server components re-check the user with Supabase `getUser()`.

## Auth integration test

With local Supabase running and the web app available:

```bash
cd apps/web
RUN_SUPABASE_AUTH_INTEGRATION=1 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local-anon-or-publishable-key> \
NEXT_APP_URL=http://127.0.0.1:3000 \
npm run test:auth-integration
```

Use only the local anon/publishable key. Do not pass a service-role key to browser or test client env.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Current scope

`LNFTI-13` adds institutional email registration, login, profile bootstrap, confirmation route, and minimal protected route handling. Broad role policies, report workflow, claim workflow, verifier dashboard, Storage, and AI integration remain separate tickets.
