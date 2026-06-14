# Supabase Migrations

Simpan seluruh migration PostgreSQL, RLS, Storage policy, dan transactional RPC pada direktori ini.

Migration awal dikerjakan pada Jira `LNFTI-12`.

Gunakan Supabase CLI untuk membuat migration baru:

```bash
npx supabase migration new descriptive_name
```

Terapkan migration dari database lokal kosong:

```bash
npx supabase db reset
```

Jalankan database tests:

```bash
npx supabase test db
```

Remote database push tidak dilakukan pada `LNFTI-12`; deployment remote membutuhkan persetujuan eksplisit terpisah.
