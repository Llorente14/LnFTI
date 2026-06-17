# LnFTI

**LnFTI** adalah Progressive Web App lost and found untuk mahasiswa FTI Universitas Tarumanagara. Aplikasi ini membantu mahasiswa melaporkan barang hilang, mencatat barang temuan, mengajukan klaim, dan mengikuti proses verifikasi sampai serah-terima selesai.

Laporan kehilangan di kampus biasanya tersebar di banyak grup chat, cepat tertimpa pesan baru, dan sulit dicari kembali. LnFTI memusatkan informasi tersebut dalam satu alur yang dapat ditelusuri oleh mahasiswa dan petugas kampus.

## Fitur utama

- katalog laporan hilang dan barang temuan;
- pencarian berdasarkan kategori dan lokasi;
- pembuatan laporan dengan deskripsi dan foto;
- ciri kepemilikan privat untuk membantu verifikasi klaim;
- pencatatan status klaim dan serah-terima;
- dashboard DPM atau petugas;
- dukungan PWA untuk perangkat mobile.

## Alur penggunaan

```text
Laporan dibuat
  → barang tampil di katalog
  → pengguna menemukan kecocokan
  → klaim diajukan dengan ciri privat
  → petugas melakukan verifikasi
  → serah-terima dicatat
```

Katalog dapat dilihat tanpa login. Autentikasi dibutuhkan ketika pengguna membuat laporan, mengajukan klaim, atau membuka area pengelolaan.

## Bantuan analisis foto

YOLO dan PaddleOCR membantu mengenali objek umum serta membaca teks pada foto. Hasil analisis hanya berupa saran dan tetap dapat diperiksa atau diubah pengguna. Fitur AI tidak menentukan kepemilikan barang dan tidak menghalangi pengisian laporan secara manual.

Teks hasil OCR hanya digunakan sebagai ciri privat, bukan sebagai deskripsi publik.

## Struktur proyek

```text
LnFTI
├── apps/web       Next.js, React, TypeScript, Tailwind CSS, PWA
├── services/ai    FastAPI, YOLO, PaddleOCR
├── supabase       PostgreSQL, Auth, Storage, RLS, pgTAP
├── docs           Dokumentasi teknis dan operasional
└── .github        CI dan repository policy
```

## Menjalankan aplikasi web

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

Jalankan pemeriksaan kualitas dari direktori `apps/web`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Dokumentasi database tersedia di [`docs/DATABASE.md`](docs/DATABASE.md).

## Kontribusi

Pekerjaan proyek dikelola melalui Jira project `LNFTI`. Branch, commit, dan pull request wajib menyertakan Jira key yang sesuai.

```text
branch: docs/LNFTI-44-readme-refresh
commit: LNFTI-44 docs(readme): refresh project documentation
PR:     [LNFTI-44] Refresh project README
```

Gunakan satu commit atomik untuk satu perubahan yang dapat ditinjau secara mandiri.

## Ruang lingkup

LnFTI dirancang untuk kebutuhan FTI Untar dan dapat dikembangkan ke lingkup kampus yang lebih besar. Sistem ini bukan pengganti prosedur keamanan kampus, melainkan penghubung dan pencatatan antara pelapor, pemilik barang, serta petugas.
