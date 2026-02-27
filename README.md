# RNGSociety

RNGSociety now has a single canonical frontend: `ui/`.

## Canonical structure

- `ui/` ? active React/Vite app (source of truth)
- `ui/src/` ? app source code
- `ui/public/` ? static assets bundled by Vite
- `ui/dist/` ? deploy artifact currently used by Cloudflare Pages in this repo setup
- `archive/legacy-2026-02-27/` ? preserved old static/prototype app files (not deleted)
- `data/`, `scripts/`, `tests/` ? supporting data tooling/tests

## Current active modules

- Singles Calculator
- Purchase Calculator
- Bag Builder

Scanner/Scanner Lab code has been intentionally sidelined per product decision and preserved in legacy/public paths.

## Local development

```bash
cd ui
npm install
npm run dev
```

## Production build

```bash
cd ui
npm install
npm run build
```

## Deploy

See `DEPLOYMENT.md` for the dual-remote + Cloudflare workflow.
