# DEPLOYMENT.md

## Standard RNGSociety deploy protocol

This repository uses a dual-remote workflow:

- `gitlab` = Cloudflare Pages deployment source
- `origin` = GitHub mirror

## One-command ship

From repo root:

```bash
git push gitlab main
git push origin main
```

(If you later define `git ship`, it should run both commands above.)

## Build/deploy mode currently in use

Cloudflare is currently consuming committed build artifacts from `ui/dist` in this repo.
Because of that, **always build before pushing** when frontend source changes.

## Safe release checklist

1. `cd ui && npm install`
2. `npm run build`
3. Confirm `ui/dist/index.html` references existing hashed files under `ui/dist/assets/`
4. `git add -A`
5. `git commit -m "..."`
6. Push both remotes:
   - `git push gitlab main`
   - `git push origin main`

## Optional future hardening (recommended)

Move Cloudflare Pages to source-build mode:

- Root directory: `ui`
- Build command: `npm ci && npm run build`
- Build output directory: `dist`

Once switched, committed `ui/dist` can be removed from git history going forward.
