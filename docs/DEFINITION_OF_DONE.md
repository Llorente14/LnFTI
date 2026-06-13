# Definition of Done

Sebuah Jira work item dapat dipindahkan ke **Done** ketika:

- Acceptance criteria terpenuhi.
- Lint, typecheck, build, dan test yang relevan berhasil.
- PostgreSQL RLS dan RPC diuji ketika database berubah.
- Tidak ada secret, service-role key, atau data sensitif di browser maupun repository.
- Upload memiliki validasi tipe, ukuran, dan otorisasi.
- Error state serta fallback tersedia.
- Pull request sudah melalui self-review.
- Setiap commit memenuhi aturan atomic commit.
- Dokumentasi dan migration diperbarui bila diperlukan.
- Perubahan telah diuji pada environment target.