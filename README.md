# LnFTI

Progressive Web App untuk pengelolaan lost and found di lingkungan FTI dengan workflow verifikasi DPM, klaim, serah-terima, serta bantuan klasifikasi berbasis YOLO dan PaddleOCR.

## Architecture

- `apps/web`: Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui + PWA
- `services/ai`: FastAPI + YOLO + PaddleOCR
- `supabase/migrations`: PostgreSQL schema, RLS, Storage policy, dan transactional RPC
- `.github`: CI, pull request template, serta repository governance

## Local setup

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

Isi `.env.local` dengan Project URL dan Publishable key dari Supabase Dashboard.
Jangan menyimpan secret key atau service-role key di repository atau variabel `NEXT_PUBLIC_*`.

## Database

Supabase local database setup, migrations, and pgTAP tests are documented in `docs/DATABASE.md`.

Pekerjaan proyek dikelola pada Jira project `LNFTI`. Setiap branch, commit, dan pull request wajib menyertakan Jira key.
