# MVP Flow Testing

`apps/web/test/mvp-flow.integration.test.mjs` is the opt-in browser integration test for the complete local MVP flow. It verifies the integrated report, AI suggestion, review, claim, Realtime, handover, public privacy, audit, storage metadata, and PWA smoke boundaries.

## Scope

The test covers one serial business scenario:

1. Verified finder creates a `FOUND` report.
2. Optional AI suggests category `Elektronik` and visible text.
3. Finder explicitly applies the category and appends OCR text to private characteristics.
4. Report moves `PENDING_REVIEW -> PUBLISHED` through verifier UI.
5. Public pages show safe report fields and omit private data.
6. Verified claimant submits ownership evidence through the public detail page.
7. Verifier approves the claim through admin UI.
8. Claimant page receives approved state through existing Realtime refresh.
9. Verifier completes physical handover through admin UI.
10. Claimant page receives completed handover information.
11. Resolved report disappears from active public browsing.

Expected state chain:

```text
Report: DRAFT -> PENDING_REVIEW -> PUBLISHED -> MATCHING -> RESOLVED
Claim:  PENDING -> APPROVED -> COMPLETED
Custody: UNKNOWN / WITH_FINDER / AT_DPM -> HANDED_OVER
```

## Actors

The test creates unique local Supabase Auth users:

- Finder: `student`, `VERIFIED`, creates the report.
- Claimant: `student`, `VERIFIED`, submits and receives the claim.
- Verifier: `verifier`, approves report, approves claim, completes handover.
- Anonymous context: checks public visibility and privacy.

Users are created through Supabase Auth. Direct local PostgreSQL updates are used only to confirm email state, set verification status, and promote the verifier role. Reports, images, claims, decisions, and handover all go through the application UI and existing Server Action/RPC paths.

## Local Guards

The test runs only when:

```bash
RUN_MVP_INTEGRATION=1
```

It rejects non-local targets:

- `NEXT_PUBLIC_SUPABASE_URL` must be `localhost` or `127.0.0.1`.
- `NEXT_APP_URL` must be `localhost` or `127.0.0.1`.
- `SUPABASE_DB_HOST` must be `localhost` or `127.0.0.1`.
- `AI_SERVICE_URL` must be `localhost` or `127.0.0.1`.

It does not require production Supabase, production secrets, service-role keys, deployed FastAPI, YOLO downloads, or PaddleOCR downloads.

## Fake AI

`apps/web/test/fixtures/fake-ai-server.mjs` is a tiny deterministic local HTTP server. It binds to `127.0.0.1`, exposes `/ready`, requires the same bearer token configured for Next.js, drains multipart uploads without logging or writing files, and returns bounded JSON for:

```text
POST /api/v1/images/detect
POST /api/v1/images/ocr
```

The fake verifies:

```text
browser -> same-origin Next.js proxy -> bearer-protected upstream -> response normalization -> explicit UI application
```

It does not test model accuracy. Real YOLO/PaddleOCR smoke belongs to manual model verification, not CI.

## Commands

Normal checks remain:

```bash
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run test
npm --prefix apps/web run build
npm --prefix apps/web run test:auth-integration
```

Complete MVP flow:

```bash
RUN_MVP_INTEGRATION=1 npm --prefix apps/web run test:mvp-integration
```

Required environment:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_APP_URL
MAILPIT_URL
SUPABASE_DB_HOST
SUPABASE_DB_PORT
SUPABASE_DB_USER
SUPABASE_DB_PASSWORD
SUPABASE_DB_NAME
AI_SERVICE_URL
AI_INTERNAL_API_TOKEN
```

CI generates `AI_INTERNAL_API_TOKEN` with Node crypto, masks it, starts the fake AI server, builds and starts Next.js, runs auth integration, then runs the complete MVP integration test.

## Diagnostics

Failure output should stay private. Allowed diagnostics are current URL, generic step name, safe workflow IDs, and safe service logs. Do not print passwords, bearer tokens, cookies, OCR/private-characteristic text, ownership evidence, full rows, image bytes, screenshots, traces, or videos by default.

## Exclusions

This test intentionally does not cover every unit-level edge case, production deployment, installability automation, Lighthouse CI, model accuracy, large screenshot/video artifacts, new workflow states, database migrations, or remote `supabase db push`. Deployment verification belongs to LNFTI-29.
