# Sales Gen Frontend

Admin workspace frontend for Sales Gen, built with Next.js App Router.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Biome
- pnpm

## Run Locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Key Scripts

```bash
pnpm dev
pnpm lint
pnpm format
pnpm build
```

## Architecture

The frontend is organized to keep reusable logic out of large UI files.

- `app/`
  - Route entries (`page.tsx`, route segment pages)
- `components/`
  - Reusable UI composition and feature UI
- `components/ui/`
  - shadcn/ui primitives
- `hooks/`
  - Reusable stateful behavior
- `lib/`
  - Framework-agnostic helpers and shared client utilities
- `types/`
  - Shared TypeScript domain and API contracts

## Workspace Module Map

The workspace feature now follows a hook-first composition model:

- `components/workspace/workspace-shell.tsx`
  - Main composition layer and page-level rendering
- `types/workspace.ts`
  - Shared workspace domain/API types
- `lib/http.ts`
  - Shared API request wrapper and API error parsing
- `lib/workspace/*`
  - Workspace-specific pure utilities and schemas
- `hooks/workspace/use-workspace-token.ts`
  - Auth token bootstrap + login redirect
- `hooks/workspace/use-workspace-data.ts`
  - Workspace data loading (me/users/clients/exports)
- `hooks/workspace/use-catalog-data.ts`
  - Catalog query/pagination/suggestions loading
- `hooks/workspace/use-catalog-actions.ts`
  - Catalog CRUD modal/form state + actions
- `hooks/workspace/use-client-actions.ts`
  - Client CRUD modal/form state + actions
- `hooks/workspace/use-user-actions.ts`
  - User CRUD modal/form state + actions
- `hooks/workspace/use-client-sales-actions.ts`
  - Client sales/OCR/export flow + form orchestration
- `hooks/workspace/use-ocr-jobs.ts`
  - OCR queue polling/websocket state
- `hooks/workspace/use-ocr-job-actions.ts`
  - OCR queue item actions (retry/stop/cleanup)

## Conventions

- Put shared types in `types/`.
- Put reusable behavior in `hooks/`.
- Put pure helpers and request utilities in `lib/`.
- Keep `workspace-shell.tsx` focused on composition and rendering.
- Prefer incremental refactors with no behavior change.

## Validation

Before merging changes:

```bash
pnpm lint
```

Run `pnpm build` only when explicitly needed for release verification.
