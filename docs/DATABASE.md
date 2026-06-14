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
