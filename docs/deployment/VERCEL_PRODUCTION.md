# Vercel Production Deployment

Repository: `Llorente14/LnFTI`
Root directory: `apps/web`
Framework: Next.js
Production branch: `main`

## Environment Variables

Required:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
APP_ORIGIN
AI_SERVICE_URL
AI_INTERNAL_API_TOKEN
AI_REQUEST_TIMEOUT_MS
```

Rules:

- `APP_ORIGIN` must equal final production web origin.
- `AI_SERVICE_URL` must be the Hugging Face Space origin only, without `/api/v1`.
- `AI_SERVICE_URL` must use HTTPS in production.
- `AI_INTERNAL_API_TOKEN` must match the Hugging Face Space Secret exactly.
- `AI_INTERNAL_API_TOKEN` must not use `NEXT_PUBLIC_`.
- Supabase publishable key may be exposed to browser code.
- Supabase secret and service-role keys are forbidden.
- Redeploy after environment variable changes.

## Build Safety

`npm run build` must not require a live AI service, YOLO download, OCR download, or production Supabase write. AI configuration is read when the same-origin AI proxy is called, not during static build.

The service worker uses local PWA assets and must not precache authenticated HTML. Preview URLs must not become `APP_ORIGIN` automatically.

## Deployment Steps

1. Import project from GitHub.
2. Set root directory to `apps/web`.
3. Confirm build command uses `npm run build`.
4. Configure production env vars.
5. Deploy selected `main` commit.
6. Inspect logs for build success and absence of secrets.
7. Run `node scripts/verify-production.mjs` from repository root with production URLs.

Do not add Vercel tokens to this repository. Custom domain setup is outside LNFTI-29.
