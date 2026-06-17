# LnFTI

**Lost and Found FTI Untar** adalah Progressive Web App untuk membantu mahasiswa melaporkan, mencari, dan mengklaim barang hilang di lingkungan kampus tanpa bergantung pada pesan grup yang cepat tenggelam.

Aplikasi ini menghubungkan tiga pihak dalam satu alur yang jelas: mahasiswa yang kehilangan barang, mahasiswa yang menemukan barang, dan DPM atau petugas kampus yang memverifikasi klaim serta serah-terima fisik.

> Status: masih dalam tahap pengembangan aktif. Fitur dan struktur data dapat berubah mengikuti hasil pengujian lapangan.

## Masalah yang diselesaikan

Informasi barang hilang di kampus biasanya tersebar di banyak grup chat. Laporan sulit dicari ulang, tidak memiliki status yang jelas, dan proses klaim sering bergantung pada percakapan pribadi.

LnFTI memusatkan proses tersebut ke dalam satu sistem:

- laporan hilang dan temuan dapat dicari kembali;
- status barang tetap tercatat sampai kasus selesai;
- klaim menyimpan bukti kepemilikan secara privat;
- DPM dapat meninjau klaim dan mencatat serah-terima barang;
- bantuan YOLO dan PaddleOCR tersedia saat mengisi laporan, tetapi keputusan akhir tetap berada di tangan pengguna dan petugas.

## Alur utama

```text
Barang hilang
  → mahasiswa membuat laporan
  → laporan tampil di katalog
  → barang yang cocok ditemukan
  → klaim diajukan dan diverifikasi
  → serah-terima dicatat

Barang ditemukan
  → penemu membuat laporan
  → barang diserahkan kepada DPM
  → pemilik mengajukan klaim dengan ciri privat
  → DPM memverifikasi
  → barang dikembalikan kepada pemilik
```

Katalog laporan dapat dilihat tanpa login. Autentikasi baru dibutuhkan ketika pengguna membuat laporan, mengajukan klaim, atau membuka area pengelolaan.

## Fitur

### Untuk mahasiswa

- melihat dan memfilter laporan hilang maupun temuan;
- membuat laporan dengan lokasi, waktu kejadian, kategori, deskripsi, dan foto;
- menyimpan ciri khusus sebagai informasi privat untuk proses verifikasi;
- mengajukan klaim dan mengikuti statusnya;
- memasang aplikasi sebagai PWA pada perangkat yang mendukung.

### Untuk DPM atau petugas

- meninjau laporan dan klaim yang masuk;
- memverifikasi bukti kepemilikan;
- mencatat penerimaan dan serah-terima barang fisik;
- menjaga status kasus tetap konsisten dari laporan hingga selesai.

### Bantuan analisis foto

Layanan AI memakai YOLO dan PaddleOCR untuk membantu mengenali kategori umum serta membaca teks yang tampak pada foto. Hasil analisis tidak diterapkan otomatis: pengguna tetap memilih informasi yang ingin digunakan, dan kegagalan layanan AI tidak menghalangi pengisian laporan secara manual.

Teks hasil OCR hanya dapat dimasukkan ke ciri privat, bukan ke deskripsi publik.

## Arsitektur

```text
LnFTI
├── apps/web
│   └── Next.js App Router, TypeScript, Tailwind CSS, PWA
├── services/ai
│   └── FastAPI, YOLO, PaddleOCR
├── supabase
│   └── PostgreSQL, RLS, Storage, migrations, pgTAP
├── docs
│   └── dokumentasi teknis dan operasional
└── .github
    └── CI, template kontribusi, dan repository policy
```

Aplikasi web berkomunikasi dengan Supabase untuk autentikasi, data, dan penyimpanan foto. Permintaan analisis gambar diteruskan melalui endpoint server-side Next.js agar alamat layanan FastAPI dan token internal tidak dikirim ke browser.

## Teknologi utama

| Area | Teknologi |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS 4, Radix UI, Tabler Icons |
| Auth dan data | Supabase Auth, PostgreSQL, Row Level Security |
| Penyimpanan | Supabase Storage |
| AI service | FastAPI, YOLO, PaddleOCR |
| Validasi | Zod |
| Testing | Node test runner, Playwright, pgTAP |
| Delivery | GitHub Actions |

## Menjalankan aplikasi web

Persyaratan lokal:

- Node.js 20.9 atau lebih baru;
- npm;
- proyek Supabase atau Supabase CLI untuk lingkungan lokal.

```bash
git clone https://github.com/Llorente14/LnFTI.git
cd LnFTI/apps/web
npm install
cp .env.example .env.local
npm run dev
```

Isi `.env.local` dengan Project URL dan publishable key dari Supabase Dashboard. Jangan menaruh service-role key atau secret lain di variabel `NEXT_PUBLIC_*`.

Aplikasi tersedia di `http://localhost:3000` setelah development server berjalan.

## Pemeriksaan kualitas

Jalankan dari direktori `apps/web`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Pengujian integrasi yang tersedia:

```bash
npm run test:auth-integration
npm run test:mvp-integration
```

Panduan database, migrations, reset lokal, dan pgTAP tersedia di [`docs/DATABASE.md`](docs/DATABASE.md).

## Batas keamanan

- Row Level Security menjadi lapisan utama pembatasan akses data.
- Bukti kepemilikan dan ciri sensitif tidak boleh ditampilkan di katalog publik.
- Secret Supabase dan token internal layanan AI tidak boleh masuk ke browser.
- Layanan AI bersifat asistif dan tidak menentukan kepemilikan barang.
- Serah-terima fisik tetap memerlukan verifikasi petugas.

## Cara berkontribusi

Pekerjaan proyek dikelola melalui Jira project `LNFTI`. Setiap branch, commit, dan pull request wajib menyertakan Jira key yang sesuai.

Contoh:

```text
branch: LNFTI-42-readme-refresh
commit: LNFTI-42 docs(readme): refresh project documentation
PR:     LNFTI-42 Refresh project README
```

Sebelum membuka pull request, pastikan lint, typecheck, test, dan build telah lulus. Gunakan satu commit atomik untuk satu perubahan yang dapat ditinjau secara mandiri.

## Catatan proyek

LnFTI dirancang untuk kebutuhan FTI Universitas Tarumanagara, tetapi struktur workflow dan data disiapkan agar dapat diperluas ke lingkup kampus yang lebih besar. Proyek ini bukan pengganti prosedur keamanan kampus; sistem berfungsi sebagai pencatatan dan penghubung antara pelapor, pemilik, dan petugas.
