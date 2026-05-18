<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from older Next.js habits. Read relevant docs in `node_modules/next/dist/docs/` before editing and heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Frontend Agent Guide

This file defines how coding agents should work in `scholarly-chat-assistant-frontend`.
Follow these rules before making changes.

## Scope

- Applies to everything under this frontend directory.
- Prefer safe, incremental changes over large rewrites.
- Preserve behavior unless the task explicitly requests a change.

## Stack And Runtime

- Next.js `16.x` (App Router)
- React `19.x`
- TypeScript
- Tailwind CSS `4`
- shadcn/ui
- Biome (lint/format)
- Package manager: `pnpm`

## Core Commands

- Install deps: `pnpm install`
- Run dev server: `pnpm dev`
- Run script: `pnpm run <script>`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Format: `pnpm format`

## Required Engineering Workflow

1. Read relevant files and route structure before editing.
2. Make the smallest change that fully satisfies the request.
3. Reuse existing UI primitives before creating new abstractions.
4. Run checks (`pnpm lint` when feasible). Avoid running `pnpm build` unless the user explicitly requests it.
5. Summarize changed files, behavior impact, and any residual risks.

## Project Structure Rules

- `app/`: route segments, layouts, pages, loading/error states.
- `components/ui/`: shadcn-generated primitives. Treat as shared UI building blocks.
- `components/`: app-specific composite components.
- `hooks/`: reusable React hooks.
- `lib/`: utilities and framework-agnostic helpers.
- `types/`: shared TypeScript type definitions.
- `public/`: static assets.

## File Placement Conventions

- Route-specific UI should live near its route unless reused.
- Shared, reusable UI belongs in `components/`.
- Avoid putting business logic directly in deeply nested JSX blocks; extract local components or helper functions when readability drops.
- Keep server-only logic out of client components.
- Put shared TypeScript contracts in `types/` (domain entities, API payloads, shared unions/enums).
- Put reusable stateful behavior in `hooks/`; prefer feature subfolders like `hooks/workspace/`.
- Put framework-agnostic helpers in `lib/`; use feature subfolders for domain logic (for example `lib/workspace/`).
- Keep one-off helpers local to a single file only when there is no near-term reuse signal.

## Reusability And Boundaries

- If logic is used by 2 or more files, extract it to `lib/`, `types/`, or `hooks/` instead of duplicating.
- Do not define shared domain types inside page/component files when they can be imported from `types/`.
- Do not define generic API request wrappers inside feature components; keep them in `lib/`.
- Keep formatting, parsing, and transformation helpers out of JSX-heavy files when they can be moved safely.

## File Size And Feature Decomposition

- Avoid monolithic feature files that mix rendering, domain types, API calls, and complex side effects.
- When a file grows beyond roughly 500 lines or spans multiple concerns, split by responsibility:
  - UI sections/components -> `components/<feature>/`
  - Hooks/state orchestration -> `hooks/<feature>/`
  - Types/contracts -> `types/<feature>.ts`
  - Pure helpers/constants -> `lib/<feature>/`
- Prefer incremental extraction with no behavior change before any functional rewrite.

## App Router Rules

- Use `app/<segment>/page.tsx` for pages and `layout.tsx` for shared shells.
- Use route groups only when they improve organization without changing URLs.
- Keep metadata accurate in route/layout files when applicable.
- Use `next/link` for internal navigation.
- Use `next/navigation` primitives (`redirect`, etc.) in the correct server/client context.

## Server And Client Component Boundaries

- Default to Server Components.
- Add `"use client"` only when needed (state, effects, event handlers, browser-only APIs).
- Do not import server-only modules into client components.
- Keep client boundaries small and intentional.

## shadcn/ui Rules

- Prefer existing shadcn components before custom one-off UI.
- Prefer shadcn UI primitives/components over native HTML elements when an equivalent exists (for example use shadcn `Button`, `Input`, `Textarea`, `Select`, `Table`, and `Dialog` instead of raw `<button>`, `<input>`, `<textarea>`, `<select>`, `<table>`, and modal markup).
- Add components with the shadcn CLI/MCP flow; avoid hand-copying registry code.
- Keep generated primitives in `components/ui/` and compose them in feature code.
- If a shadcn component requires provider wiring (for example `TooltipProvider`), ensure it is added in `app/layout.tsx` or the appropriate shared layout.

## Styling Rules

- Use Tailwind utility classes and existing design tokens from `app/globals.css`.
- Prefer tokenized colors (`bg-background`, `text-foreground`, etc.) over hardcoded colors.
- Keep styles consistent with existing spacing, sizing, and typography scales.
- Avoid inline styles except for dynamic values that cannot be expressed cleanly with utilities.

## State, Data, And Side Effects

- Keep pages presentational unless the task needs data wiring.
- For forms, start simple and add schema/validation only when required.
- Isolate async/data-fetch logic so rendering remains easy to follow.
- Handle empty/loading/error states for non-trivial data views.

## Code Quality Expectations

- Write typed, readable code with explicit names.
- Keep modules focused and small.
- Prefer composition over deep prop drilling.
- Avoid introducing new dependencies unless clearly justified.
- Preserve backward compatibility of existing routes and expected UI behavior unless requested otherwise.

## Engineering Principles

- KISS: choose the simplest solution that fully solves the requirement.
- DRY: avoid duplicate logic and styles; extract shared pieces when repetition is real.
- YAGNI: do not add speculative abstractions, options, or features.
- SOLID (pragmatic): keep boundaries clear across UI, state, and data layers.
- Single responsibility: components/modules should have one primary reason to change.
- Explicit over implicit: make data flow, navigation, and side effects easy to trace.
- Separation of concerns: keep presentation, behavior, and data access cleanly separated.
- Consistency over novelty: follow existing project patterns before introducing new ones.

## Performance And Accessibility

- Avoid unnecessary client-side rendering.
- Keep bundle impact in mind when adding libraries/components.
- Use semantic HTML and accessible labels for form controls.
- Ensure keyboard-accessible navigation and interactive elements.

## Do Not

- Do not bypass existing App Router conventions.
- Do not place unrelated logic changes in the same edit.
- Do not silently alter route paths or navigation structure without explicit request.
- Do not hardcode secrets or environment-specific endpoints in components.
- Do not revert unrelated user changes.

## Definition Of Done

- Requested UI/behavior is implemented.
- Lint/format status is reported (`pnpm lint` and/or `pnpm format` when relevant).
- File structure and component boundaries remain clean and maintainable.
