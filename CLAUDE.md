# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo Layout

pnpm + Turborepo monorepo:

- `apps/editor` — next-gen React editor (`@behaviortrees/editor`): React 19, TypeScript, Vite, React Flow, Tailwind 4, Zustand. See its CLAUDE.md.
- `apps/editor-classic` — classic AngularJS 1.4 + gulp 3 editor. **Not a workspace member**: it has its own npm `package-lock.json`. Never run pnpm inside it. See its CLAUDE.md.
- `apps/site` — Astro guides site (`@behaviortrees/site`), served at /learn.
- `packages/examples` — shared example trees (`@behaviortrees/examples`), JSON in `trees/`. Single source of truth for both editors.

## Commands (repo root)

- `pnpm install` — install workspace dependencies
- `pnpm dev --filter @behaviortrees/editor` — React editor dev server
- `pnpm dev --filter @behaviortrees/site` — guides site dev server
- `pnpm build` — build editor + site via Turborepo
- `pnpm test` / `pnpm lint` — editor test suite / eslint
- `pnpm build:classic` — install + build the classic editor (needs Node <= 22, see `.nvmrc`)
- `pnpm build:all` — everything
- `bash build-deploy.sh` — assemble the full behaviortrees.com site into `deploy/` (what Netlify runs)

## Deployment

- Vercel (www.behaviortrees.com, the main site): root directory `apps/editor`, `apps/editor/vercel.json`. Serves the React editor, the Astro site at `/learn/`, and the serverless sync API at `/api/`. The Vercel build must always bundle the Astro site into `dist/` so `/learn` survives independently of the Netlify deploy — do not remove that copy step. new.behaviortrees.com redirects here.
- Netlify (old.behaviortrees.com): `netlify.toml` → `build-deploy.sh` → classic editor at `/`, Astro site at `/learn/`.
