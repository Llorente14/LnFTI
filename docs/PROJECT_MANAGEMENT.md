# LnFTI Project Management

## Jira board

Gunakan alur:

```text
Backlog → Ready → In Progress → Review / CI → Testing → Done
```

WIP limit yang disarankan untuk solo developer:

- In Progress: 1
- Review / CI: 1
- Testing: 1

## Issue types

- **Epic**: kemampuan produk besar.
- **Story**: fungsi yang dirasakan pengguna.
- **Task**: pekerjaan teknis.
- **Bug**: perilaku yang menyimpang dari hasil yang diharapkan.
- **Spike**: eksperimen time-boxed dengan keluaran berupa keputusan.

## Delivery order

- 14 Juni 2026: platform, Supabase, Auth, RLS, dan Storage.
- 15 Juni 2026: laporan barang, verifikasi DPM, klaim, RPC serah-terima, dan Realtime.
- 16 Juni 2026: PWA, YOLO, PaddleOCR, integration test, deployment, dan runbook.

## Repository areas

- `apps/web`: Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui + PWA.
- `services/ai`: FastAPI + YOLO + PaddleOCR.
- `supabase/migrations`: schema, RLS, RPC, dan Storage policy.
- `.github`: CI dan workflow governance.

## Execution rule

Kerjakan ticket sesuai nilai **Urutan** pada deskripsi Jira. Pertahankan WIP limit satu dan jangan memulai ticket berikutnya sebelum ticket aktif masuk Review / CI atau selesai.