# LNFTI-29 Readiness Report

Status: repository prepared for manual production setup. No remote production deployment has been performed from this branch.

## Prerequisites

- PR #26 merged into `main`: `d6ee7fffc67be221bebd0d37d171ade86a155067`.
- Latest `main` CI after merge is green.
- Jira LNFTI-28 status could not be confirmed from this environment because Atlassian connector access was unavailable.

## Web Build

The web app already validates Supabase URL, publishable key, `APP_ORIGIN`, AI service URL, internal AI token length, and AI timeout. Production build does not call YOLO, OCR, or a live AI service.

Required Vercel root: `apps/web`.

## AI Container Viability

`services/ai/Dockerfile` uses Python 3.12 slim, installs pinned requirements, runs `pip check`, uses non-root runtime user, exposes port `7860`, and health-checks `/api/v1/health` without model initialization.

YOLO and PaddleOCR remain lazy-loaded at runtime.

## Production Environment Names

Web:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `APP_ORIGIN`
- `AI_SERVICE_URL`
- `AI_INTERNAL_API_TOKEN`
- `AI_REQUEST_TIMEOUT_MS`

AI:

- `ENVIRONMENT`
- `API_PREFIX`
- `AI_INTERNAL_API_TOKEN`
- `ALLOWED_ORIGINS`
- image, YOLO, and OCR variables listed in `docs/deployment/AI_SPACE.md`

## Database Migration Order

Use committed migrations in timestamp order through `supabase db push` after `supabase db push --dry-run` review. Do not include seed data. Do not reset linked production.

## Storage Bucket

The `report-images` bucket must remain private. Public image access must continue through public metadata and signed URLs, not public bucket exposure.

## Realtime Publication

Only `public.reports`, `public.claims`, and `public.handovers` should be published for targeted Realtime.

## Auth Redirects

Set Supabase Auth Site URL to final Vercel production origin. Use exact callback/redirect URLs for the deployed app. Do not disable email confirmation.

## Internal AI Token Boundary

Browser calls only Next.js same-origin proxy. Vercel sends bearer token to Hugging Face Space. Token is secret on both platforms and must not use `NEXT_PUBLIC_`.

## Remaining Manual Platform Actions

1. Create/select Supabase production project.
2. Create Hugging Face Docker Space and configure variables/secrets.
3. Create Vercel project with root `apps/web` and env vars.
4. Run Supabase dry-run and reviewed push.
5. Deploy AI Space package.
6. Deploy Vercel web.
7. Configure Supabase Auth URLs.
8. Bootstrap exactly one admin/verifier.
9. Run production smoke tests and fill deployment record.
