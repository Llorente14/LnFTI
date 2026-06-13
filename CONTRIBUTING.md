# Contributing to LnFTI

## Source of truth

Jira project `LNFTI` adalah sumber pekerjaan. Jangan membuat backlog duplikat pada GitHub Issues.

## Start work

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feature/LNFTI-16-found-item-form
```

## Branch naming

```text
<type>/LNFTI-<issue-number>-<short-slug>
```

Tipe branch yang diperbolehkan: `feature`, `fix`, `chore`, `docs`, `test`, `refactor`, `spike`, `ci`, dan `build`.

## Atomic commits

Format:

```text
LNFTI-<issue-number> <type>(<scope>): <imperative summary>
```

Contoh:

```text
LNFTI-16 feat(items): add found item form
LNFTI-16 test(items): cover invalid image upload
LNFTI-14 fix(rls): block unauthorized item updates
```

Sebelum commit:

```bash
git status
git diff
git add -p
git diff --staged
git commit
```

Satu commit harus memuat satu perubahan logis, tetap dapat di-build atau diuji, dan tidak menggunakan pesan seperti `WIP`, `final`, atau `fix again`.

## Pull request

Judul:

```text
[LNFTI-16] Add found item form
```

Gunakan pola:

```text
1 Jira issue → 1 branch → beberapa atomic commits → 1 pull request
```

## Merge

Gunakan **rebase and merge** setelah CI hijau dan self-review selesai. Hindari merge commit untuk menjaga riwayat `main` tetap linear.