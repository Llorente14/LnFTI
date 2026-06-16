# Production Runbook

## Architecture

```text
browser -> Vercel Next.js -> Supabase Cloud
browser -> Vercel same-origin AI proxy -> Hugging Face Docker Space -> YOLO/PaddleOCR
```

Browsers never call the Hugging Face AI service directly. The web app uses Supabase publishable key only. AI image endpoints require a server-to-server bearer token.

## Prerequisites

- PR #26 merged into `main`.
- Latest `main` CI green.
- Supabase production project created.
- Hugging Face Space repo created with Docker SDK.
- Vercel project configured with root `apps/web`.
- Matching AI token configured as Hugging Face Secret and Vercel secret env var.
- No production secrets shared in chat or committed files.

## Deployment Order

1. Supabase
2. Hugging Face AI service
3. Vercel web
4. Supabase Auth URL update
5. Public smoke test
6. Admin bootstrap
7. Full controlled MVP smoke test

## Supabase Deployment

Follow `docs/deployment/SUPABASE_PRODUCTION.md`. Use migration dry-run, review pending migrations, then push once. Do not include seed data.

## AI Space Deployment

Package source:

```bash
node scripts/package-hf-space.mjs
```

Upload generated `dist/huggingface-space` contents to the approved Docker Space. Configure:

- Secret: `AI_INTERNAL_API_TOKEN`
- Variables: model and image limits from `services/ai/.env.example`
- `ALLOWED_ORIGINS` as final Vercel origin
- `ENVIRONMENT=production`

Health check:

```text
GET https://<space-host>/api/v1/health
```

First inference may be slow because YOLO and PaddleOCR load lazily and may download model assets. Use a non-sensitive sample image for warm-up.

## Vercel Deployment

Follow `docs/deployment/VERCEL_PRODUCTION.md`. Confirm root directory, env vars, build logs, and deployment URL.

## Smoke Tests

Public:

```bash
PRODUCTION_WEB_URL=https://<web-host> \
PRODUCTION_AI_URL=https://<space-host> \
node scripts/verify-production.mjs
```

Authenticated MVP:

1. Anonymous public browse.
2. Finder registers/logs in and creates safe `FOUND` report.
3. Optional AI analysis succeeds or fails safely without erasing form data.
4. Verifier approves report.
5. Public page shows safe fields only.
6. Claimant submits claim.
7. Verifier approves claim.
8. Claimant page updates through Realtime.
9. Verifier completes handover.
10. Claim becomes `COMPLETED`, report becomes `RESOLVED`, custody becomes `HANDED_OVER`.
11. Resolved report leaves public active listing.

PWA:

- manifest loads;
- 192 and 512 icons load;
- service worker activates;
- offline fallback appears;
- private authenticated HTML is not served from cache.

Realtime:

- keep claimant page open;
- approve claim from verifier session;
- observe approved state;
- complete handover;
- observe completed state;
- confirm no duplicate refresh storm.

Privacy:

- private characteristics absent from public pages;
- ownership evidence absent from public pages;
- handover notes absent from public pages;
- Storage paths absent from public pages;
- AI token absent from browser traffic;
- browser calls same-origin proxy, not Space URL.

## Rollback

Web:

- identify previous successful Vercel deployment;
- promote or redeploy previous version;
- confirm env consistency;
- rerun public smoke script.

AI:

- identify previous healthy Space commit;
- revert/redeploy that commit;
- confirm health endpoint;
- run one non-sensitive warm-up analysis.

Database:

- never run production reset;
- never delete applied migration history;
- create forward corrective migration;
- take export/backup before risky correction;
- coordinate one database deployer.

Secrets:

- rotate AI token if exposure suspected;
- update Hugging Face Secret first;
- update Vercel immediately after;
- redeploy Vercel;
- invalidate old token.

## Free-Tier Limits

Hugging Face Space can sleep. Cold start or AI timeout must leave report form usable manually. Do not add artificial keep-alive traffic.

Supabase outage should show safe error states. Vercel outage rollback target is previous production deployment. Storage quota failures must be visible and must not show false submission success.

## Deployment Record

Use `docs/deployment/DEPLOYMENT_RECORD_TEMPLATE.md`. Record only non-secret values.
