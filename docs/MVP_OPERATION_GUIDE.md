# MVP Operation Guide

This guide covers day-to-day verifier/admin operation for the LnFTI MVP.

## Access

- Verifier and admin users can open `/admin`.
- Students can submit reports and claims, but cannot access `/admin`.
- Keep source workbooks, downloaded exports, and screenshots with student data outside Git.

## DPM Inventory Import

Open:

```text
/admin/inventory/import
```

Use the DPM workbook in `.xlsx` format. The importer expects these headers:

```text
Nama Barang
Foto Barang
Ditemukan Di-
Tanggal Turun dari Fakultas
Status Barang
Tanggal Barang diambil
Foto Bukti Pengambilan Barang
```

The parser reads worksheet cells with ExcelJS and resolves embedded images from OOXML drawing relationships. Item photos are matched from `Foto Barang`; pickup evidence is matched from `Foto Bukti Pengambilan Barang`.

Import flow:

1. Upload workbook.
2. Review preview counts, row warnings, thumbnails, and duplicate indicators.
3. Correct editable row fields when needed: category, location, found date, DPM status, and pickup date.
4. Save row corrections.
5. Select only `VALID` or `WARNING` rows.
6. Commit selected rows.

Rows with `ERROR` must be corrected before commit. Rows with `WARNING` can be committed after verifier/admin review. `FAILED` rows must be corrected and validated before retry. `IMPORTED` and `SKIPPED` rows are not importable.

Status mapping:

| DPM status | Report status | Custody status |
| --- | --- | --- |
| `SEKRE DPM` | `PUBLISHED` | `AT_DPM` |
| `PROKER` | `CLOSED` | `AT_DPM` |
| `SIAP DIDONASIKAN` | `CLOSED` | `AT_DPM` |
| `DIAMBIL MAHASISWA` | `RESOLVED` | `HANDED_OVER` |

Import workbooks and media are staged in the private `inventory-imports` bucket. Item photos are promoted to `report-images` only when the row is committed successfully. Pickup evidence remains private in `inventory-imports`.

`DIAMBIL MAHASISWA` requires a valid pickup date. The importer must not use the import time as a replacement pickup date.

Import commits are audited by `public.import_inventory_row`. The RPC creates the found report, attaches the imported item image when present, stores pickup evidence metadata privately, skips cross-job duplicate rows safely, and writes audit log entries for success or failure.

## DPM Inventory Export

Open:

```text
/admin/inventory/export
```

Choose XLSX for a DPM-like workbook snapshot or CSV for data review. Exports include found reports only and can be filtered by period year, event date range, report status, custody status, category, and location. The app rejects date ranges where `from` is after `to`, and rejects exports larger than 500 rows.

XLSX exports embed item photos as workbook images. Default exports do not include pickup evidence. Admin users can choose "Sertakan bukti pengambilan" for sensitive XLSX export only after entering a reason of at least 10 characters. Verifier users cannot enable sensitive export.

CSV exports contain safe boolean indicators for item image and pickup evidence presence. CSV exports never contain binary files, signed URLs, private storage paths, or pickup evidence.

Export files are stored in the private `inventory-exports` bucket. The UI returns an internal download link that creates a short-lived signed URL only after auth, ownership/admin, status, and expiry checks pass. Do not paste signed URLs into tickets, PRs, or public chat because they temporarily grant file access.

## Data Retention

- Import workbooks are stored in the private `inventory-imports` bucket.
- Staged item and pickup-evidence media are stored under `<user_id>/<job_id>/...` in `inventory-imports`.
- Export files are stored in the private `inventory-exports` bucket.
- Inventory import jobs have an `expires_at` timestamp for cleanup automation.
- Export jobs have an `expires_at` timestamp. Sensitive exports expire faster than default exports.
- `public.expire_inventory_files()` deletes expired staged import files and export files, marks jobs `EXPIRED`, and writes audit entries. It does not delete permanent report images from imported rows.

## Local Verification

Run application checks:

```bash
cd apps/web
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Local Docker/Supabase may be unavailable on a developer machine. Do not replace local Docker checks with production-linked commands, and do not run `supabase db push`, migration repair, or destructive commands against the production Supabase project.

Repository GitHub Actions are the authoritative validation for database reset from migrations, pgTAP/database tests, database lint, auth integration tests, and MVP integration tests.

The workflow runs:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase db lint --level warning
npm run test:auth-integration
npm run test:mvp-integration
```

Remote database push is a separate deployment step and is not part of normal local verification.
