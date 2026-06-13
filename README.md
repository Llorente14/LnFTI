# LnFTI

Progressive Web App untuk pengelolaan lost and found di lingkungan FTI dengan workflow verifikasi DPM, klaim, serah-terima, serta bantuan klasifikasi berbasis YOLO dan PaddleOCR.

## Architecture

- `apps/web`: Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui + PWA
- `services/ai`: FastAPI + YOLO + PaddleOCR
- `supabase/migrations`: PostgreSQL schema, RLS, Storage policy, dan transactional RPC
- `.github`: CI, pull request template, serta repository governance

Pekerjaan proyek dikelola pada Jira project `LNFTI`. Setiap branch, commit, dan pull request wajib menyertakan Jira key.