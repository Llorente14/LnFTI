# Design: LnFTI — Untar Lost & Found

> Baseline MVP v1.1 — Jira LNFTI-33

## Ringkasan

LnFTI adalah PWA untuk mahasiswa Universitas Tarumanagara melaporkan dan mencari barang hilang atau temuan. Sistem mengubah laporan yang sebelumnya tersebar di grup chat menjadi data terstruktur, dapat dicari ulang, diverifikasi DPM, diklaim dengan bukti, dan diaudit.

## Prinsip Produk

- Browse laporan publik tanpa login.
- Login hanya untuk membuat laporan, klaim, dan tindakan verifier.
- Form laporan selesai dalam median kurang dari dua menit.
- Ciri privat, bukti kepemilikan, kontak, dan hasil OCR lengkap tidak tampil publik.
- YOLO dan PaddleOCR hanya memberikan saran yang dapat dikoreksi.
- Verifikasi, klaim, serah-terima, dan ekspor selalu menghasilkan audit log.
- Mobile-first dan dapat dipasang sebagai PWA.

## Role

- `student`: browse, membuat laporan, mengelola laporan sendiri, dan mengajukan klaim.
- `verifier`: role DPM pada MVP; menilai laporan/klaim, mengelola barang fisik, serah-terima, audit, dan ekspor.
- `admin`: mengelola role dan konfigurasi sistem; seluruh tindakan tetap diaudit.

Nama internal memakai `verifier`, bukan `dpm`, agar dapat diperluas untuk satpam atau staf kemahasiswaan.

## Model Domain

### Report Type

```text
LOST
FOUND
```

LOST dan FOUND menggunakan satu tabel `reports` dengan `report_type`.

### Report Status

```text
DRAFT
PENDING_REVIEW
PUBLISHED
MATCHING
RESOLVED
REJECTED
CLOSED
```

### Claim Status

```text
PENDING
APPROVED
REJECTED
EXPIRED
CANCELLED
COMPLETED
```

### Custody Status

```text
WITH_FINDER
AT_DPM
HANDED_OVER
UNKNOWN
```

Ketiga status disimpan terpisah. Contoh kondisi valid: report `PUBLISHED`, claim `PENDING`, custody `AT_DPM`.

## Privacy Matrix

| Data | Publik | Student terkait | Verifier/Admin | Ekspor default |
|---|---:|---:|---:|---:|
| Nama umum, kategori, lokasi umum | Ya | Ya | Ya | Ya |
| Tanggal dan deskripsi publik | Ya | Ya | Ya | Ya |
| Ciri privat barang | Tidak | Ya | Ya | Tidak |
| Bukti kepemilikan | Tidak | Ya | Ya | Tidak |
| Nama lengkap dan kontak | Tidak | Ya | Ya | Tidak |
| Hasil OCR lengkap | Tidak | Pemilik laporan | Ya | Tidak |
| Audit metadata aman | Tidak | Terbatas | Ya | Ya |

## Information Architecture

```text
Publik: Beranda • Semua Laporan • Detail Laporan
Student: Buat Laporan • Laporan Saya • Klaim Saya • Profil
Verifier: Dashboard • Review Laporan • Review Klaim • Barang di DPM
          Serah Terima • Audit Log • Ekspor Data
```

## Route Awal

```text
/
/reports
/reports/[id]
/report/new
/login
/me/reports
/me/claims
/admin
/admin/reports
/admin/claims
/admin/custody
/admin/audit
/admin/exports
```

Gunakan `/reports?type=lost` dan `/reports?type=found`, bukan dua implementasi halaman terpisah.

## User Flow

### Membuat laporan

```text
Browse → pilih LOST/FOUND → login bila perlu → isi form
→ AI memberi saran opsional → pengguna mengoreksi/konfirmasi
→ submit → PENDING_REVIEW → verifier approve → PUBLISHED
```

Form memisahkan `deskripsi publik` dan `ciri privat`. AI gagal tidak boleh menggagalkan submit manual.

### Klaim dan serah-terima

```text
Buka FOUND → Ajukan Klaim → isi bukti privat → PENDING
→ verifier APPROVED/REJECTED
→ handover RPC memperbarui report, claim, custody, handover,
  dan audit log secara atomik
```

### Ekspor audit

```text
Verifier memilih periode dan filter → Excel/CSV
→ sistem mengecualikan data sensitif secara default
→ job selesai → signed download URL sementara
→ request dan download dicatat pada audit log
```

## Layout

### Desktop

```text
[Navbar 56px: L&F | Beranda | Laporan | Login | Laporkan]
[Hero pendek + dua CTA LOST/FOUND + search]
[Filter tipe dan kategori]
[Grid 3 kolom laporan terbaru]
```

Daftar laporan memakai sidebar filter 240px. Detail laporan memakai komposisi 60:40 dengan panel informasi sticky. Dashboard verifier memakai sidebar dan side sheet untuk review.

### Mobile

```text
[L&F                              Cari]
[Lapor Hilang] [Lapor Temuan]
[Search]
[Filter chips horizontal]
[Report card horizontal]
[Home | Cari | +Lapor | Saya]
```

Filter daftar memakai bottom sheet. Tombol klaim pada detail menjadi sticky bottom action.

### Form

Satu halaman dengan empat bagian:

1. tipe LOST/FOUND;
2. nama, kategori, deskripsi publik, ciri privat;
3. kampus, gedung, detail lokasi, tanggal/waktu;
4. maksimal tiga foto opsional.

## Visual Direction

Tone: kampus resmi tetapi tidak kaku. Tidak memakai gradient atau box shadow tebal.

```text
Crimson Deep   #6B1220
Crimson Core   #8B1A2B
Crimson Mid    #B22335
Crimson Pale   #F5E8EA
Gold Accent    #C8963A
Gold Pale      #FDF5E6
Warm White     #FAF8F7
Surface        #FFFFFF
Near Black     #1A0A0D
Text Muted     #997080
```

Tombol gold menggunakan teks gelap `#1A0A0D`, bukan putih. Plus Jakarta Sans digunakan untuk heading/tombol/badge dan DM Sans untuk body/input. Kartu desktop memakai image ratio 4:3, radius 12px, border halus, tanpa shadow. Kartu mobile dapat horizontal dengan thumbnail sekitar 112px.

## Komponen UI

Navbar desktop, bottom navigation mobile, report card, status badge, search bar, filter chips, bottom sheet, form field, upload preview, claim dialog, review side sheet, toast, stat card, data table, export panel, empty state, dan skeleton loading.

## Interaction dan AI

- Search debounce 300ms; request final setelah Enter atau tombol cari.
- Upload jpg/png/webp maksimal 5MB per file.
- Validasi inline setelah blur.
- Submit menggunakan idempotency key.
- Redirect login menyimpan return URL.
- YOLO memberi saran kategori/bounding box.
- PaddleOCR memberi saran teks.
- Confidence hanya bantuan dan hasil OCR mentah tidak tampil publik.
- Kartu identitas dimasking sebelum preview publik.

## Accessibility

- Kontras teks minimum 4.5:1.
- Touch target minimum 44×44px.
- Focus ring `2px solid #B22335` dengan offset 2px.
- Label eksplisit dan error melalui `aria-describedby`.
- Status tidak disampaikan melalui warna saja.
- Dialog dan side sheet mengunci fokus.

## Ekspor Audit

Ekspor Excel/CSV adalah fitur MVP untuk audit kampus. Detail teknis berada di `docs/AUDIT_EXPORT.md` dan Jira `LNFTI-34`.

## Stack

Next.js App Router + TypeScript, Tailwind, shadcn/ui, Tabler Icons, Supabase Auth/PostgreSQL/RLS/Storage/Realtime terbatas, PostgreSQL RPC, FastAPI YOLO + PaddleOCR, Vercel, dan Railway/container service. NextAuth tidak digunakan.

## Handoff

`LNFTI-8` hanya mencakup fondasi Next.js, TypeScript strict, Tailwind, shadcn/ui, font, design tokens, Tabler Icons, responsive app shell, dan placeholder route. Jangan memasukkan Supabase atau AI pada branch tersebut.

Urutan inti: LNFTI-11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 34.
