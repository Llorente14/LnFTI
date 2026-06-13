# LnFTI Web Agent Guide

- Work from a Jira ticket and include the `LNFTI-<id>` key in branch, commit, and pull request names.
- Keep App Router pages server components unless browser-only behavior is required.
- Preserve the public/private data boundary defined in `/DESIGN.md`.
- Use Supabase Auth only; do not introduce NextAuth.
- Use design tokens from `src/app/globals.css` instead of arbitrary brand colors.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before requesting review.
- AI suggestions must always have a manual fallback and must never expose raw OCR publicly.
