# LnFTI MVP Operation Guide

> **Jira:** LNFTI-30 — Document MVP operation guide  
> **Status dokumen:** Draft operasional  
> **Production web:** `https://ln-fti.vercel.app`  
> **Dependency:** LNFTI-29 selesai; prosedur ekspor final menunggu LNFTI-34.

## 1. Tujuan

Dokumen ini menjadi runbook operasional untuk menyiapkan, mendemonstrasikan, mengoperasikan, memulihkan, dan mengaudit MVP LnFTI. Dokumen ditujukan untuk developer, verifier/DPM, admin, dan pihak kampus yang melakukan peninjauan sistem.

Runbook ini tidak boleh memuat password, cookie, JWT, database password, service-role key, internal bearer token, confirmation link aktif, atau data pribadi mahasiswa.

## 2. Ruang lingkup MVP

LnFTI adalah PWA lost and found untuk mahasiswa FTI Universitas Tarumanagara. MVP mencakup:

- katalog laporan yang dapat dilihat publik;
- registrasi dan login mahasiswa;
- pemisahan konfirmasi email Supabase Auth dari verifikasi profil bisnis;
- pembuatan laporan hilang atau temuan;
- unggah foto laporan ke Storage privat;
- bantuan foto opsional menggunakan YOLO dan PaddleOCR;
- pengajuan dan pemeriksaan klaim;
- pencatatan serah-terima;
- audit log append-only;
- dashboard verifier/admin;
- rancangan job ekspor audit.

Ekspor Excel/CSV secara end-to-end belum dianggap tersedia sampai LNFTI-34 selesai dan lolos pengujian produksi.

## 3. Arsitektur operasional

```text
Browser / PWA
    |
    v
Next.js web di Vercel
    |-- Supabase Auth
    |-- PostgreSQL + RLS
    |-- Supabase Storage privat
    |-- server-side AI proxy
            |
            v
       FastAPI AI service
       |-- YOLO
       `-- PaddleOCR
```

Prinsip keamanan utama:

1. Browser hanya menggunakan Supabase publishable key.
2. Service-role key tidak boleh berada pada aplikasi web atau variabel `NEXT_PUBLIC_*`.
3. Web mengakses AI service melalui proxy server-side.
4. `AI_INTERNAL_API_TOKEN` harus sama pada web dan AI service, tetapi tidak boleh masuk browser atau repository.
5. RLS tetap menjadi enforcement utama untuk data pengguna.
6. Hasil AI adalah saran dan tidak boleh menjadi penentu kepemilikan atau blocker untuk laporan manual.

## 4. Peran dan hak akses

| Peran | Akses utama |
| --- | --- |
| Publik | Melihat dan mencari laporan yang boleh dipublikasikan. |
| Student | Membuat laporan, mengelola laporan sendiri, dan mengajukan klaim sesuai policy. |
| Verifier/DPM | Meninjau profil, laporan, klaim, dan proses serah-terima sesuai scope operasional. |
| Admin | Akses administratif sesuai policy, termasuk pengawasan audit dan ekspor ketika LNFTI-34 tersedia. |

Jangan menguji akses verifier/admin menggunakan akun student yang role-nya diubah sementara tanpa catatan. Gunakan akun uji khusus setiap peran.

## 5. Persyaratan lokal

- Node.js 20.9 atau lebih baru.
- npm 10 atau lebih baru.
- Supabase CLI versi yang dikunci proyek.
- Docker Desktop atau runtime Docker lain.
- Python dan dependency AI sesuai `services/ai`.

Instal Supabase CLI bila belum tersedia:

```bash
npm install --global supabase@2.106.0
```

## 6. Setup environment

### 6.1 Web

Buat environment lokal dari template:

```bash
cd apps/web
npm install
cp .env.example .env.local
```

Variabel yang digunakan:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
APP_ORIGIN
AI_SERVICE_URL
AI_INTERNAL_API_TOKEN
AI_REQUEST_TIMEOUT_MS
```

Aturan:

- `APP_ORIGIN` lokal menggunakan `http://localhost:3000`.
- Hosted environment wajib menggunakan HTTPS dan origin tanpa path/query.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` harus publishable/anon-compatible key, bukan secret atau service-role key.
- `AI_SERVICE_URL` dan `AI_INTERNAL_API_TOKEN` bersifat server-only.
- Nilai asli hanya disimpan pada secret manager environment terkait.

Jalankan web:

```bash
npm run dev
```

Pemeriksaan kualitas web:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### 6.2 Supabase lokal

Dari root repository:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase db lint --level warning
npx supabase migration list
```

Environment lokal tidak boleh diarahkan ke database produksi untuk pengujian destruktif.

### 6.3 AI service

Salin template environment AI dan isi hanya pada environment lokal/secret manager:

```text
APP_NAME
APP_VERSION
ENVIRONMENT
API_PREFIX
AI_INTERNAL_API_TOKEN
ALLOWED_ORIGINS
IMAGE_MAX_BYTES
IMAGE_MAX_PIXELS
IMAGE_ALLOWED_MEDIA_TYPES
YOLO_MODEL_PATH
YOLO_DEVICE
YOLO_CONFIDENCE_THRESHOLD
YOLO_IOU_THRESHOLD
YOLO_IMAGE_SIZE
YOLO_MAX_DETECTIONS
OCR_LANGUAGE
OCR_DEVICE
OCR_MIN_CONFIDENCE
OCR_MAX_LINES
OCR_MAX_TEXT_CHARS
OCR_TEXT_DETECTION_MODEL
OCR_TEXT_RECOGNITION_MODEL
```

Token internal harus random, minimal 32 karakter, dan sama dengan token server-side web. Jangan menuliskannya pada screenshot atau output issue.

## 7. Akun verifier dan akun demo

### 7.1 Ketentuan

- Gunakan email institusional atau akun uji yang telah disetujui pemilik sistem.
- Password dibagikan melalui kanal privat dan tidak dicatat di Jira, GitHub, Confluence publik, atau dokumen ini.
- Konfirmasi email Auth dan status verifikasi profil adalah dua status terpisah.
- Akun verifier harus memiliki email confirmed dan role `verifier` melalui prosedur administratif yang sah.
- Hindari mengubah akun produksi mahasiswa menjadi verifier hanya untuk demo.

### 7.2 Checklist akun verifier

- [ ] Email Auth sudah confirmed.
- [ ] Row profil tersedia.
- [ ] Role adalah `verifier`.
- [ ] Status profil sesuai policy aplikasi.
- [ ] Login berhasil pada production origin.
- [ ] Halaman verifier dapat dibuka.
- [ ] Halaman student-only yang tidak sesuai role tetap ditolak.
- [ ] Logout menghapus session browser yang relevan.

### 7.3 Akun demo minimum

Siapkan secara privat:

1. satu akun student terverifikasi sebagai pelapor;
2. satu akun student terverifikasi sebagai claimant;
3. satu akun verifier/DPM;
4. opsional satu akun admin untuk pemeriksaan audit/ekspor.

Gunakan data barang fiktif. Jangan memakai bukti kepemilikan, nomor kartu, kontak, atau hasil OCR milik mahasiswa nyata.

## 8. Pemeriksaan sebelum demo

### 8.1 Deployment

- [ ] Production hostname membuka aplikasi tanpa `DEPLOYMENT_NOT_FOUND`.
- [ ] Commit production sesuai commit yang disetujui.
- [ ] Vercel deployment berstatus sukses.
- [ ] Hosted Supabase project sehat.
- [ ] AI service dapat dicapai oleh proxy server-side.
- [ ] Environment production tidak berisi placeholder.

### 8.2 Browser/PWA

- [ ] Gunakan Chrome profile bersih atau incognito.
- [ ] Hapus site data bila hasil tampak stale.
- [ ] Unregister service worker lama bila diperlukan.
- [ ] Pastikan network dan console tidak menunjukkan error kritis.

### 8.3 Data demo

- [ ] Tidak ada laporan lama dengan nama yang sama dan membingungkan.
- [ ] Foto demo berukuran di bawah batas Storage/AI.
- [ ] Foto tidak mengandung data pribadi.
- [ ] Catat ID laporan/klaim demo secara privat untuk cleanup.

## 9. Workflow demo end-to-end

```text
Publik melihat katalog
    -> Student login
    -> Student membuat laporan
    -> Verifier meninjau laporan/barang
    -> Student lain mengajukan klaim
    -> Verifier memeriksa bukti privat
    -> Klaim disetujui atau ditolak
    -> Serah-terima dicatat
    -> Audit event diperiksa
    -> Ekspor audit dilakukan setelah LNFTI-34 tersedia
```

### 9.1 Browse publik

1. Buka halaman utama tanpa session.
2. Cari laporan berdasarkan kata kunci.
3. Gunakan filter kategori/lokasi yang tersedia.
4. Buka detail laporan.
5. Pastikan ciri privat, bukti klaim, kontak pribadi, dan OCR lengkap tidak tampil publik.

### 9.2 Login student

1. Buka login melalui production origin.
2. Login dengan akun student confirmed dan verified.
3. Pastikan redirect menuju halaman internal yang valid.
4. Refresh halaman dan buka tab baru untuk memastikan session bertahan.

Fresh signup-confirm-login harus diuji terpisah dengan email institusional baru dan pemilik mailbox menekan link konfirmasi sendiri.

### 9.3 Membuat laporan

1. Buka form laporan.
2. Pilih tipe laporan hilang/temuan.
3. Isi nama barang, kategori, lokasi, waktu, deskripsi publik, dan ciri privat.
4. Lakukan smoke test pertama tanpa foto untuk mengisolasi database/RLS.
5. Submit dan pastikan redirect sukses.
6. Pastikan row laporan mencapai `PENDING_REVIEW` sesuai flow saat ini.
7. Ulangi dengan foto valid untuk menguji Storage.

Catat ID laporan demo agar dapat ditelusuri pada audit.

### 9.4 Bantuan analisis foto

1. Unggah JPEG/PNG/WebP yang valid.
2. Jalankan bantuan foto secara manual.
3. Periksa request proxy AI.
4. Pastikan verified student tidak menerima authorization 403.
5. Periksa label deteksi, confidence, saran kategori, dan OCR.
6. Pastikan pengguna tetap dapat mengubah field manual.
7. Pastikan kegagalan/cold start AI tidak menghalangi submit manual.
8. Jangan memindahkan hasil OCR ke deskripsi publik.

### 9.5 Pemeriksaan verifier

1. Login sebagai verifier.
2. Buka antrean yang relevan.
3. Cocokkan laporan dengan data fisik/barang yang diserahkan.
4. Hindari menyalin bukti privat ke komentar publik.
5. Lakukan keputusan melalui UI/RPC resmi, bukan edit database langsung.
6. Pastikan perubahan status menghasilkan audit event.

### 9.6 Pengajuan klaim

1. Login sebagai student berbeda dari pelapor.
2. Buka laporan temuan yang sesuai.
3. Ajukan klaim menggunakan bukti fiktif yang hanya diketahui skenario demo.
4. Pastikan bukti tidak muncul di katalog publik.
5. Catat ID klaim untuk audit.

### 9.7 Review klaim

Verifier memeriksa:

- kecocokan ciri privat;
- konsistensi waktu dan lokasi;
- status laporan dan custody;
- konflik klaim lain;
- kelengkapan bukti tanpa mengekspos data pribadi.

Keputusan harus dilakukan menggunakan action resmi aplikasi. Bila klaim ditolak, alasan internal harus ringkas, faktual, dan tidak memuat data sensitif tambahan.

### 9.8 Serah-terima

1. Pastikan klaim yang menjadi dasar serah-terima sudah berada pada status yang diizinkan.
2. Verifier memastikan identitas pihak sesuai prosedur kampus di luar aplikasi.
3. Jalankan action serah-terima resmi.
4. Pastikan status klaim/laporan/custody konsisten.
5. Periksa audit event dan timestamp.
6. Jangan mencatat nomor identitas lengkap di field bebas.

## 10. Prosedur ekspor Excel dan CSV

### 10.1 Status implementasi

Bagian ini adalah kontrak operasional untuk LNFTI-34. Jangan menyatakan fitur ekspor siap produksi sebelum implementasi, authorization, file generation, expiry, cleanup, dan audit logging selesai diuji.

Schema `export_jobs` sudah menyediakan konsep:

- format `XLSX` atau `CSV`;
- requester;
- dataset;
- snapshot filter;
- flag data sensitif dan alasan;
- status `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, atau `EXPIRED`;
- jumlah row;
- private storage path;
- waktu selesai dan kedaluwarsa.

### 10.2 Hak akses

- Hanya verifier dan admin yang boleh memulai atau mengunduh ekspor.
- Student dan user tanpa session harus ditolak.
- Storage path tidak boleh berupa public URL.
- Signed URL, bila digunakan, harus singkat masa berlakunya dan tidak dicatat pada audit/log aplikasi.

### 10.3 Filter yang harus didukung LNFTI-34

- rentang tanggal;
- tipe laporan;
- status;
- lokasi;
- kategori.

Filter aktual harus disimpan sebagai snapshot pada job agar hasil dapat diaudit walaupun filter UI berubah di kemudian hari.

### 10.4 Struktur Excel

Workbook XLSX harus memiliki sheet:

1. `Ringkasan`;
2. `Laporan`;
3. `Klaim`;
4. `Serah Terima`;
5. `Audit Log`.

Setiap sheet harus memiliki header stabil, timestamp dengan timezone yang jelas, dan ID teknis yang diperlukan untuk rekonsiliasi. Hindari formula aktif dari input pengguna untuk mencegah spreadsheet formula injection; nilai yang dimulai dengan `=`, `+`, `-`, atau `@` harus dinetralisasi sesuai implementasi LNFTI-34.

### 10.5 CSV

CSV digunakan untuk interoperabilitas. Karena satu file CSV hanya mewakili satu tabel/dataset, UI harus menjelaskan dataset yang dipilih atau menghasilkan paket terpisah sesuai keputusan LNFTI-34.

Ketentuan minimum:

- UTF-8;
- header konsisten;
- escaping RFC-compatible;
- timezone eksplisit;
- perlindungan formula injection;
- tidak memasukkan kolom sensitif secara default.

### 10.6 Data yang dikecualikan secara default

- bukti kepemilikan lengkap;
- kontak pribadi;
- hasil OCR lengkap;
- token, cookie, signed URL, storage credential;
- data internal lain yang tidak dibutuhkan untuk tujuan audit.

Ekspor sensitif, bila akhirnya didukung, wajib memerlukan izin lebih tinggi, alasan eksplisit, scope minimum, dan audit event tersendiri.

### 10.7 Penyimpanan sementara dan expiry

- File disimpan di bucket/path privat.
- `storage_path` menyimpan object path, bukan URL publik.
- `expires_at` wajib diisi ketika job selesai.
- Durasi retention final ditetapkan dan diuji oleh LNFTI-34.
- Job kedaluwarsa harus berubah menjadi `EXPIRED` dan object harus dibersihkan.
- File tidak boleh dikirim melalui repository, issue attachment publik, atau chat umum.

### 10.8 Audit ekspor

Audit minimal harus mencatat:

- aktor/requester;
- waktu permintaan dan selesai;
- format dan dataset;
- snapshot filter;
- jumlah row;
- apakah data sensitif diminta;
- alasan ekspor sensitif bila berlaku;
- status akhir;
- referensi job, bukan signed download URL.

## 11. Privasi dan penanganan data

1. Terapkan least privilege.
2. Jangan menyalin ciri privat ke deskripsi publik.
3. Jangan menampilkan hasil OCR lengkap di katalog.
4. Jangan memasukkan password, token, cookie, atau header authorization dalam screenshot.
5. Blur/redact email, NIM, kontak, bukti kepemilikan, dan identifier pribadi ketika bukti QA dibagikan.
6. Gunakan data fiktif untuk demo.
7. Jangan mengunduh data produksi hanya untuk pengujian UI.
8. File ekspor harus dianggap data terbatas dan hanya dibagikan melalui kanal kampus yang disetujui.
9. Jangan menyimpan file ekspor melebihi masa berlaku operasional.

## 12. Prosedur audit sengketa

Gunakan prosedur ini ketika klaim, serah-terima, atau ekspor dipersoalkan.

### 12.1 Intake

Catat secara privat:

- waktu laporan sengketa;
- pelapor sengketa;
- `report_id`;
- `claim_id` bila ada;
- `handover_id` bila ada;
- `export_job_id` bila ada;
- ringkasan masalah tanpa menyalin bukti sensitif yang tidak diperlukan.

### 12.2 Preservation

- Jangan menghapus atau mengubah audit log.
- Jangan melakukan edit langsung pada tabel produksi untuk “merapikan” status.
- Pertahankan file ekspor terkait bila masih dalam retention dan ada otorisasi legal/operasional untuk hold.
- Jangan membagikan signed URL atau credential sebagai bukti.

### 12.3 Rekonsiliasi

Urutkan event berdasarkan timestamp dan periksa:

1. aktor dan role pada setiap action;
2. status laporan sebelum/sesudah action;
3. status klaim sebelum/sesudah keputusan;
4. custody dan serah-terima;
5. action/RPC yang digunakan;
6. untuk ekspor: requester, filter snapshot, format, row count, status, expiry;
7. apakah terdapat gap, duplicate action, atau perubahan yang tidak melalui workflow resmi.

### 12.4 Keputusan

- Gunakan bukti sistem dan prosedur kampus, bukan hanya screenshot pengguna.
- Batasi reviewer pada verifier/admin yang berwenang.
- Untuk kasus berisiko tinggi, gunakan review dua orang sebagai kontrol operasional.
- Dokumentasikan kesimpulan, tindakan korektif, dan referensi ID; jangan menyalin data sensitif berlebihan.

### 12.5 Koreksi

- Koreksi dilakukan melalui action/RPC resmi atau migration forward-fix.
- Jangan mengubah audit event historis.
- Tindakan korektif harus menghasilkan audit event baru.
- Bila bug aplikasi ditemukan, buat Jira Bug terpisah dengan langkah reproduksi yang sudah disanitasi.

### 12.6 Sengketa ekspor

- Verifikasi bahwa requester memang verifier/admin.
- Cocokkan filter snapshot dengan kebutuhan yang disetujui.
- Cocokkan row count dan dataset.
- Pastikan file belum kedaluwarsa pada waktu akses.
- Bila file expired, buat job baru dengan filter yang disetujui; jangan menghidupkan kembali signed URL lama.
- Catat alasan regenerasi pada audit.

## 13. Rollback sederhana

### 13.1 Web/Vercel

1. Identifikasi deployment terakhir yang sehat.
2. Catat commit bermasalah dan gejala.
3. Redeploy/promote deployment sehat sebelumnya melalui Vercel.
4. Pastikan environment variables tidak berubah atau terhapus.
5. Jalankan smoke test login, browse, report submit, dan verifier access.
6. Buat Jira Bug dan lakukan forward fix pada branch baru.

Jangan force-push `main` sebagai metode rollback produksi.

### 13.2 AI service

1. Jika AI bermasalah tetapi flow manual sehat, pertahankan web dan perlakukan AI sebagai optional failure.
2. Rollback ke revision/image AI sehat sebelumnya.
3. Pastikan token internal tetap sinkron dengan web.
4. Uji endpoint health dan satu analisis gambar fiktif.
5. Jangan membuka endpoint AI tanpa auth sebagai jalan pintas.

### 13.3 Database/Supabase

Database tidak boleh di-rollback dengan menghapus migration production secara spontan.

Urutan respons:

1. hentikan deployment aplikasi yang memanggil schema baru bila perlu;
2. rollback web ke versi kompatibel;
3. siapkan migration forward-fix yang aman;
4. uji `db reset`, pgTAP, lint, dan integration test secara lokal;
5. lakukan perubahan remote hanya dengan approval eksplisit;
6. gunakan restore backup hanya sebagai langkah terakhir dengan penanggung jawab dan dampak yang jelas.

### 13.4 Storage dan file ekspor

- Jangan membuat bucket publik saat rollback.
- Hapus object sementara hanya jika referensi dan retention sudah diperiksa.
- Jangan menghapus bukti yang sedang berada dalam audit hold.

## 14. Known limitations

- LNFTI-34 belum selesai; ekspor Excel/CSV belum boleh dianggap siap.
- Fresh signup-email-confirmation production memerlukan email institusional baru untuk smoke test penuh.
- YOLO general-purpose dapat gagal pada foto close-up karena domain shift.
- PaddleOCR dapat menghasilkan teks parsial atau salah; hasil tetap perlu review pengguna.
- AI service dapat mengalami cold start atau partial result.
- Fitur AI tidak menggantikan verifikasi kepemilikan.
- PWA/service worker dapat menampilkan asset lama sampai cache dibersihkan.
- Scope awal ditujukan untuk FTI dan belum membuktikan skala universitas penuh.
- Sistem merupakan alat pencatatan dan koordinasi, bukan pengganti prosedur keamanan kampus.

## 15. Monitoring dan smoke test pascadeploy

Setelah setiap deployment production:

- [ ] Halaman publik 200.
- [ ] Protected route mengarahkan user tanpa session ke login.
- [ ] Login akun confirmed berhasil.
- [ ] Session bertahan setelah refresh.
- [ ] Verified student dapat membuat laporan sampai `PENDING_REVIEW`.
- [ ] AI proxy tidak menolak verified student dengan 403 profile authorization.
- [ ] Manual report tetap dapat digunakan saat AI gagal.
- [ ] Verifier dapat membuka dashboard yang sesuai.
- [ ] Aksi klaim/serah-terima menghasilkan status konsisten.
- [ ] Tidak ada secret atau PII pada console/log bukti QA.
- [ ] Setelah LNFTI-34: ekspor hanya tersedia untuk verifier/admin dan menghasilkan audit event.

## 16. Checklist penutupan LNFTI-30

Dokumen boleh dianggap memenuhi LNFTI-30 ketika:

- [x] setup environment didokumentasikan;
- [x] aturan akun verifier didokumentasikan tanpa credential;
- [x] alur demo end-to-end didokumentasikan;
- [x] rollback sederhana didokumentasikan;
- [x] known limitations didokumentasikan;
- [x] privasi dan akses data ekspor didokumentasikan;
- [x] prosedur audit klaim, serah-terima, dan ekspor didokumentasikan;
- [ ] implementasi dan prosedur ekspor telah divalidasi terhadap LNFTI-34;
- [ ] hostname, menu, filter, nama sheet, retention, dan cleanup ekspor telah diuji di production;
- [ ] reviewer verifier/admin menyetujui runbook final.

Selama dua item ekspor tersebut belum selesai, PR LNFTI-30 sebaiknya tetap draft atau tiket tetap menunggu dependency LNFTI-34.

## 17. Referensi

- `README.md`
- `docs/DATABASE.md`
- `apps/web/.env.example`
- `services/ai/.env.example`
- Jira LNFTI-29
- Jira LNFTI-34

## 18. Riwayat revisi

| Versi | Tanggal | Perubahan |
| --- | --- | --- |
| 0.1 | 2026-06-17 | Draft awal runbook LNFTI-30; bagian ekspor ditandai menunggu LNFTI-34. |
