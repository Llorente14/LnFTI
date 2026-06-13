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

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Current scope

`LNFTI-11` adds Supabase environment configuration and client boundaries only. Database schema, RLS, Storage, workflow logic, login UI, and AI integration are intentionally handled by later Jira tickets.
