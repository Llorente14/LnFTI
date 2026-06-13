# LnFTI Web Application

Next.js App Router application for the LnFTI lost-and-found platform.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer

## Local development

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Current scope

`LNFTI-8` provides the TypeScript-strict Next.js foundation, Tailwind CSS, shadcn/ui configuration, brand design tokens, responsive app shell, and placeholder routes. Supabase, storage, workflow logic, and AI integration are intentionally handled by later Jira tickets.
